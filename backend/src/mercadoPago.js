import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { Account, Freight } from "./models.js";
import { authorize, fail } from "./auth.js";
import { notifyAccounts, notifyMasters } from "./webPush.js";

const paymentSchema = new mongoose.Schema({
  freightId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Freight", index: true },
  kind: { type: String, enum: ["freight", "commission"], required: true },
  payerId: { type: String, required: true },
  externalReference: { type: String, required: true, unique: true },
  idempotencyKey: { type: String, required: true },
  amountCents: { type: Number, required: true, min: 1 },
  paymentId: { type: String, default: "", index: true },
  status: { type: String, default: "created" },
  qrCode: { type: String, default: "" },
  qrCodeBase64: { type: String, default: "" },
  expiresAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  reviewRequired: { type: Boolean, default: false },
}, { timestamps: true });
paymentSchema.index({ freightId: 1, kind: 1 }, { unique: true });
export const MercadoPagoOrder = mongoose.models.FreteOnMercadoPagoOrder ||
  mongoose.model("FreteOnMercadoPagoOrder", paymentSchema);

export function mercadoPagoEnabled() {
  return process.env.MP_PAYMENTS_ENABLED === "true" &&
    Boolean(process.env.MP_ACCESS_TOKEN?.trim()) &&
    Boolean(process.env.MP_WEBHOOK_SECRET?.trim()) &&
    /^https:\/\/[^/]+$/.test(process.env.MP_PUBLIC_URL?.trim() || "");
}

const cleanId = value => String(value || "").trim();
const validCpf = input => {
  const digits = String(input || "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  for (const size of [9, 10]) {
    const total = digits.slice(0, size).split("").reduce((sum, digit, index) =>
      sum + Number(digit) * (size + 1 - index), 0);
    const check = ((total * 10) % 11) % 10;
    if (check !== Number(digits[size])) return false;
  }
  return true;
};

export function verifyMercadoPagoSignature({ signature, requestId, paymentId, secret, now = Date.now() }) {
  if (!signature || !requestId || !/^\d{1,30}$/.test(cleanId(paymentId)) || !secret) return false;
  const pairs = Object.fromEntries(String(signature).split(",").map(pair => {
    const index = pair.indexOf("=");
    return [pair.slice(0, index).trim(), pair.slice(index + 1).trim()];
  }));
  if (!/^\d{10,16}$/.test(pairs.ts || "") || !/^[a-f0-9]{64}$/i.test(pairs.v1 || "")) return false;
  const timestamp = Number(pairs.ts) < 1e12 ? Number(pairs.ts) * 1000 : Number(pairs.ts);
  if (Math.abs(now - timestamp) > 15 * 60 * 1000) return false;
  const manifest = `id:${cleanId(paymentId).toLowerCase()};request-id:${requestId};ts:${pairs.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  const actual = Buffer.from(pairs.v1, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function mpRequest(method, endpoint, body, idempotencyKey) {
  if (!mercadoPagoEnabled()) fail(503, "Pagamentos Mercado Pago ainda não estão configurados.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`https://api.mercadopago.com${endpoint}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN.trim()}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) fail(502, "O Mercado Pago não conseguiu processar a operação. Tente novamente.");
    return await response.json();
  } catch (error) {
    if (error.status) throw error;
    fail(502, "Não foi possível consultar o Mercado Pago. Tente novamente.");
  } finally {
    clearTimeout(timer);
  }
}

const amountFor = (freight, kind) => {
  const value = kind === "commission" ? freight.commissionCents : freight.agreedPriceCents;
  if (!Number.isSafeInteger(value) || value < 100) fail(409, "Valor indisponível para gerar Pix.");
  return value;
};
export function canCreateMercadoPagoPix(freight, kind, user) {
  if (!freight || !["commission", "freight"].includes(kind)) fail(400, "Cobrança inválida.");
  const id = String(user._id);
  if (kind === "freight") {
    if (user.role !== "cliente" || freight.clientId !== id ||
        freight.paymentMethod !== "pix_freteon" || freight.status !== "booked" ||
        freight.paymentStatus !== "awaiting" || freight.refundStatus === "pending")
      fail(409, "Este frete não permite gerar um novo Pix.");
  } else if (user.role !== "motorista" || freight.driverId !== id ||
    !["cash_driver", "card_driver"].includes(freight.paymentMethod) ||
    freight.commissionStatus !== "pending" || freight.disputeStatus === "open" ||
    ["pending", "approved", "refunded_simulated"].includes(freight.refundStatus))
    fail(409, "Esta comissão não permite gerar Pix.");
  return amountFor(freight, kind);
}

const publicOrder = order => ({
  kind: order.kind, status: order.status,
  amountCents: order.amountCents, paymentId: order.paymentId,
  qrCode: order.qrCode, qrCodeBase64: order.qrCodeBase64,
  expiresAt: order.expiresAt, reviewRequired: order.reviewRequired,
});

async function synchronize(order, payment) {
  if (String(payment.id) !== order.paymentId ||
      payment.external_reference !== order.externalReference ||
      payment.payment_method_id !== "pix" ||
      payment.currency_id !== "BRL" ||
      Math.round(Number(payment.transaction_amount) * 100) !== order.amountCents) {
    console.warn("Conciliação Mercado Pago rejeitada: dados divergentes.");
    return;
  }
  const nextStatus = String(payment.status || "pending");
  const alreadyApproved = order.status === "approved";
  if (order.status === "refunded" && nextStatus !== "refunded") return;
  if (alreadyApproved && !["approved", "refunded"].includes(nextStatus)) return;
  const freight = await Freight.findById(order.freightId);
  if (!freight) return;
  let accepted = false;
  if (nextStatus === "refunded" && order.kind === "freight") {
    // Reembolso feito no próprio Mercado Pago não pode continuar liberando
    // repasse ao motorista; se já houver repasse, exigir conciliação manual.
    const change = await Freight.updateOne({
      _id: freight._id, paymentStatus: "paid_mp",
      payoutStatus: { $nin: ["paid_simulated", "paid_manual"] }
    }, { $set: {
      paymentStatus: "refunded_mp", refundStatus: "refunded_mp",
      refundAmountCents: order.amountCents, refundedAt: new Date(),
      payoutStatus: "none"
    } });
    accepted = Boolean(change.modifiedCount);
    if (!accepted) order.reviewRequired = true;
  }
  if (nextStatus === "approved") {
    if (order.kind === "commission") {
      const result = await Freight.updateOne({
        _id: freight._id, commissionStatus: "pending",
        commissionCents: order.amountCents, driverId: order.payerId,
        disputeStatus: { $ne: "open" },
        refundStatus: { $nin: ["pending", "approved", "refunded_simulated", "refunded_mp"] }
      }, { $set: { commissionStatus: "paid", commissionPaidAt: new Date() } });
      accepted = Boolean(result.modifiedCount);
    } else {
      const result = await Freight.updateOne({
        _id: freight._id, clientId: order.payerId,
        paymentMethod: "pix_freteon", paymentStatus: "awaiting",
        agreedPriceCents: order.amountCents, status: { $in: ["booked", "transit", "completed", "cancelled"] }
      }, { $set: { paymentStatus: "paid_mp" } });
      // Se o Pix chegou após o cancelamento, registre o recebimento sem liberar repasse.
      accepted = Boolean(result.modifiedCount) && freight.status !== "cancelled";
    }
  }
  order.status = nextStatus;
  if (["approved", "refunded"].includes(nextStatus)) order.verifiedAt ||= new Date();
  if (nextStatus === "approved" && !accepted && !alreadyApproved) order.reviewRequired = true;
  await order.save();
  if (nextStatus === "refunded" && !alreadyApproved) {
    void notifyMasters({
      title: accepted ? "Estorno Mercado Pago confirmado" : "Estorno exige conciliação",
      body: accepted ? "Pagamento Pix devolvido. Confira o Financeiro." : "Pagamento estornado com repasse ou situação divergente. Confira manualmente.",
      category: "financeiro", id: String(order.freightId),
    });
  }
  if (nextStatus === "approved" && !alreadyApproved) {
    if (accepted) {
      void notifyMasters({
        title: order.kind === "commission" ? "Comissão paga por Pix" : "Frete pago por Pix",
        body: "O Mercado Pago confirmou um pagamento. Consulte o Financeiro.",
        category: "financeiro", id: String(order.freightId),
      });
      const recipient = order.kind === "freight" ? freight.driverId : freight.driverId;
      if (recipient) void notifyAccounts([recipient], {
        role: "motorista", title: order.kind === "freight" ? "Pix do frete confirmado" : "Comissão quitada",
        body: "Pagamento confirmado pelo Mercado Pago. Confira sua carteira.",
        id: String(order.freightId),
      }).catch(() => {});
      if (order.kind === "freight") void notifyAccounts([freight.clientId], {
        role: "cliente", title: "Pagamento Pix confirmado",
        body: "O Mercado Pago confirmou o pagamento do frete.", id: String(order.freightId)
      }).catch(() => {});
    } else void notifyMasters({
      title: "Pagamento Pix requer conferência",
      body: "Pagamento aprovado após mudança de situação do frete. Não efetue repasse sem conciliar.",
      category: "financeiro", id: String(order.freightId),
    });
  }
}
async function refreshOrder(order) {
  if (order.paymentId && !["cancelled", "rejected", "refunded"].includes(order.status)) {
    const payment = await mpRequest("GET", `/v1/payments/${encodeURIComponent(order.paymentId)}`);
    await synchronize(order, payment);
  }
  return order;
}

// Reembolso real: exclusivo de Pix já confirmado e previamente autorizado pelo Master.
export async function refundMercadoPagoPayment(freight) {
  if (!mercadoPagoEnabled() || freight.paymentStatus !== "paid_mp")
    fail(409, "Reembolso real indisponível para este frete.");
  const order = await MercadoPagoOrder.findOne({ freightId: freight._id, kind: "freight" });
  if (!order?.paymentId || order.amountCents !== freight.agreedPriceCents ||
      !["approved", "refunded"].includes(order.status))
    fail(409, "Pagamento não conciliado. Verifique o Mercado Pago antes de reembolsar.");
  // Se o provedor confirmou a devolução antes de uma falha de rede, concluir a gravação local.
  if (order.status === "refunded") return { id: order.paymentId, status: "approved" };
  const result = await mpRequest("POST", `/v1/payments/${encodeURIComponent(order.paymentId)}/refunds`, {},
    `refund-${order.idempotencyKey}`);
  if (!result?.id || !["approved", "processed"].includes(String(result.status || "")))
    fail(409, "A devolução ainda não foi confirmada pelo Mercado Pago. Consulte o painel de pagamentos.");
  order.status = "refunded";
  order.verifiedAt = new Date();
  await order.save();
  return result;
}

export const mercadoPagoPrivate = Router();
mercadoPagoPrivate.get("/mercadopago/config", (req, res) =>
  res.json({ enabled: mercadoPagoEnabled(), provider: "mercadopago", mode: mercadoPagoEnabled() ? "real" : "simulation" })
);
mercadoPagoPrivate.post("/mercadopago/orders/:id/:kind", async (req, res) => {
  if (!mercadoPagoEnabled()) fail(503, "Configure a conta Mercado Pago do FreteOn no Render.");
  if (!mongoose.isValidObjectId(req.params.id)) fail(404, "Frete não encontrado.");
  const freight = await Freight.findById(req.params.id);
  const amountCents = canCreateMercadoPagoPix(freight, req.params.kind, req.user);
  const email = String(req.body?.email || "").trim().toLowerCase();
  const cpf = String(req.body?.cpf || "").replace(/\D/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)
    fail(400, "Informe um e-mail válido para gerar o Pix.");
  if (!validCpf(cpf)) fail(400, "Informe um CPF válido para o Mercado Pago.");

  let order = await MercadoPagoOrder.findOne({ freightId: freight._id, kind: req.params.kind });
  if (!order) {
    try {
      order = await MercadoPagoOrder.create({
        freightId: freight._id, kind: req.params.kind,
        payerId: String(req.user._id), amountCents,
        externalReference: `freteon-${req.params.kind}-${freight._id}-${randomUUID()}`,
        idempotencyKey: randomUUID(),
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      order = await MercadoPagoOrder.findOne({ freightId: freight._id, kind: req.params.kind });
    }
  }
  if (order.payerId !== String(req.user._id) || order.amountCents !== amountCents)
    fail(409, "Existe uma cobrança anterior com dados divergentes. Contate o suporte.");
  if (order.status === "approved") return res.json(publicOrder(order));
  if (!order.paymentId) {
    const body = {
      transaction_amount: order.amountCents / 100,
      description: order.kind === "freight" ? "Frete contratado - FreteOn" : "Comissao de frete - FreteOn",
      payment_method_id: "pix", external_reference: order.externalReference,
      payer: { email, identification: { type: "CPF", number: cpf } },
    };
    body.notification_url = `${process.env.MP_PUBLIC_URL.trim()}/api/mercadopago/webhook`;
    const payment = await mpRequest("POST", "/v1/payments", body, order.idempotencyKey);
    if (!/^\d+$/.test(String(payment.id || "")))
      fail(502, "O Mercado Pago não retornou um identificador de pagamento válido.");
    order.paymentId = String(payment.id);
    // Reconciliar aprovação antes de gravar o status, para não ignorar a primeira confirmação.
    order.status = "pending";
    order.qrCode = payment.point_of_interaction?.transaction_data?.qr_code || "";
    order.qrCodeBase64 = payment.point_of_interaction?.transaction_data?.qr_code_base64 || "";
    order.expiresAt = payment.date_of_expiration ? new Date(payment.date_of_expiration) : null;
    await order.save();
    await synchronize(order, payment);
  } else await refreshOrder(order);
  return res.json(publicOrder(order));
});
mercadoPagoPrivate.get("/mercadopago/orders/:id/:kind", async (req, res) => {
  if (!mercadoPagoEnabled()) fail(503, "Mercado Pago não configurado.");
  if (!mongoose.isValidObjectId(req.params.id)) fail(404, "Frete não encontrado.");
  const freight = await Freight.findById(req.params.id);
  if (!freight) fail(404, "Frete não encontrado.");
  const owner = req.params.kind === "freight" ? freight.clientId : freight.driverId;
  if (String(req.user._id) !== owner && req.user.role !== "master") fail(403, "Acesso negado.");
  const order = await MercadoPagoOrder.findOne({ freightId: freight._id, kind: req.params.kind });
  if (!order) return res.json({ status: "none" });
  await refreshOrder(order);
  res.json(publicOrder(order));
});
export const mercadoPagoPublic = Router();
mercadoPagoPublic.post("/webhook", async (req, res) => {
  if (!mercadoPagoEnabled()) return res.sendStatus(503);
  const type = req.query.type || req.body?.type;
  if (type !== "payment") return res.sendStatus(200);
  // O identificador precisa estar na URL assinada. Nunca confiar só no JSON de entrada.
  const id = cleanId(req.query["data.id"] || req.query.id);
  if (!verifyMercadoPagoSignature({
    signature: req.get("x-signature"), requestId: req.get("x-request-id"),
    paymentId: id, secret: process.env.MP_WEBHOOK_SECRET
  })) return res.sendStatus(401);
  const order = await MercadoPagoOrder.findOne({ paymentId: id });
  if (!order) return res.sendStatus(200);
  const payment = await mpRequest("GET", `/v1/payments/${encodeURIComponent(id)}`);
  await synchronize(order, payment);
  res.sendStatus(200);
});
