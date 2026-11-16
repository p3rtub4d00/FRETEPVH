import { randomUUID, createHash, timingSafeEqual, createPublicKey, verify as verifySignature } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { Freight } from "./models.js";
import { fail } from "./auth.js";
import { notifyAccounts, notifyMasters } from "./webPush.js";
import { canCreateMercadoPagoPix } from "./mercadoPago.js";
import { providerReady } from "./paymentProviderSettings.js";

const schema = new mongoose.Schema({
  freightId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Freight", index: true },
  kind: { type: String, enum: ["freight", "commission"], required: true },
  payerId: { type: String, required: true },
  externalReference: { type: String, unique: true, required: true },
  amountCents: { type: Number, required: true, min: 100 },
  environment: { type: String, enum: ["sandbox", "production"], default: "sandbox" },
  idempotencyKey: { type: String, required: true },
  attemptedAt: { type: Date, default: null },
  orderId: { type: String, default: "", index: true },
  chargeId: { type: String, default: "", index: true },
  status: { type: String, default: "created" },
  qrCode: { type: String, default: "" },
  qrCodeBase64: { type: String, default: "" },
  expiresAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  reviewRequired: { type: Boolean, default: false }
}, { timestamps: true });
schema.index({ freightId: 1, kind: 1 }, { unique: true });
export const PagBankOrder = mongoose.models.FreteOnPagBankOrder ||
  mongoose.model("FreteOnPagBankOrder", schema);

export const pagBankEnabled = () => providerReady("pagbank");
const baseUrl = () => process.env.PAGBANK_ENV === "production"
  ? "https://api.pagseguro.com" : "https://sandbox.api.pagseguro.com";

async function pagbankRequest(method, endpoint, payload, idempotencyKey, binary = false) {
  if (!pagBankEnabled()) fail(503, "Integração PagBank ainda não configurada.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 13000);
  try {
    const response = await fetch(`${baseUrl()}${endpoint}`, {
      method, signal: controller.signal, headers: {
        Authorization: `Bearer ${process.env.PAGBANK_TOKEN.trim()}`,
        Accept: binary ? "image/png" : "application/json",
        ...(payload !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
      },
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {})
    });
    if (!response.ok) {
      const error = new Error(response.status === 403
        ? "PagBank recusou o acesso. Verifique a liberação da API de Pedidos."
        : "PagBank indisponível ou cobrança não autorizada.");
      error.status = 502;
      error.pagbankDefinitiveRejection = [400, 401, 403, 422].includes(response.status);
      throw error;
    }
    if (binary) {
      const bytes = Buffer.from(await response.arrayBuffer());
      return bytes.length > 10 && bytes.length < 150000 ? bytes.toString("base64") : "";
    }
    return await response.json();
  } catch (error) {
    if (error.status) throw error;
    fail(502, "Falha na comunicação com o PagBank. Consulte a cobrança antes de repetir.");
  } finally {
    clearTimeout(timeout);
  }
}
export const publicPagBankOrder = order => ({
  provider: "pagbank", kind: order.kind, status: order.status,
  amountCents: order.amountCents, paymentId: order.chargeId || order.orderId,
  qrCode: order.qrCode, qrCodeBase64: order.qrCodeBase64,
  expiresAt: order.expiresAt, reviewRequired: order.reviewRequired
});
export function verifyPagBankWebhook(rawBody, signatureHeader, publicKeyBase64) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length > 50000 ||
      !signatureHeader || !publicKeyBase64) return false;
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeyBase64, "base64"),
      format: "der", type: "spki" });
    const sigs = (Array.isArray(signatureHeader) ? signatureHeader : String(signatureHeader).split(","))
      .map(x => x.trim()).filter(Boolean);
    return sigs.some(signature => {
      try { return verifySignature("sha256", rawBody, key, Buffer.from(signature, "base64")); }
      catch { return false; }
    });
  } catch { return false; }
}

export function verifyLegacyPagBankWebhook(rawBody, header, token) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length > 50000 ||
      !/^[a-f0-9]{64}$/i.test(String(header || "")) || !token) return false;
  const expected = createHash("sha256")
    .update(token).update("-").update(rawBody).digest();
  const given = Buffer.from(String(header), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function syncPagBankOrder(order, remote) {
  const charge = remote?.charges?.find(item => item.id === order.chargeId);
  if (remote?.id !== order.orderId || !charge ||
      charge.reference_id !== order.externalReference ||
      charge.payment_method?.type !== "PIX" ||
      charge.amount?.currency !== "BRL" ||
      charge.amount?.value !== order.amountCents) {
    console.warn("PagBank: divergência na conciliação da cobrança.");
    return false;
  }
  let status = charge.status === "PAID" ? "approved" :
    charge.status === "CANCELED" ? "cancelled" :
    charge.status === "DECLINED" ? "rejected" : "pending";
  if (status === "cancelled" &&
      Number(charge.amount?.summary?.refunded || 0) >= order.amountCents)
    status = "refunded";
  const previous = order.status;
  if (previous === "refunded" && status !== "refunded") return false;
  if (previous === "approved" && !["approved", "refunded"].includes(status)) return false;
  if (previous === status) return true;
  const freight = await Freight.findById(order.freightId);
  if (!freight) return false;
  let valid = false;
  if (status === "approved") {
    if (order.kind === "commission") {
      const change = await Freight.updateOne({
        _id: freight._id, driverId: order.payerId,
        commissionStatus: "pending", commissionCents: order.amountCents,
        disputeStatus: { $ne: "open" },
        refundStatus: { $nin: ["pending", "approved", "refunded_simulated", "refunded_mp", "refunded_pagbank"] }
      }, { $set: { commissionStatus: "paid", commissionPaidAt: new Date(),
        commissionProvider: "pagbank",
        commissionProviderEnvironment: order.environment } });
      valid = Boolean(change.modifiedCount);
    } else {
      const change = await Freight.updateOne({
        _id: freight._id, clientId: order.payerId,
        paymentMethod: "pix_freteon", paymentStatus: "awaiting",
        agreedPriceCents: order.amountCents,
        status: { $in: ["booked", "transit", "completed", "cancelled"] }
      }, { $set: { paymentStatus: "paid_pagbank", paymentProvider: "pagbank",
        paymentProviderEnvironment: order.environment } });
      valid = Boolean(change.modifiedCount) && freight.status !== "cancelled";
    }
  } else if (status === "refunded" && order.kind === "freight") {
    const change = await Freight.updateOne({
      _id: freight._id, paymentStatus: "paid_pagbank",
      payoutStatus: { $nin: ["paid_manual", "paid_simulated"] }
    }, { $set: {
      paymentStatus: "refunded_pagbank", refundStatus: "refunded_pagbank",
      payoutStatus: "none", refundAmountCents: order.amountCents, refundedAt: new Date()
    } });
    valid = Boolean(change.modifiedCount);
  }
  if (["approved", "refunded"].includes(status) && !valid) order.reviewRequired = true;
  order.status = status;
  if (["approved", "refunded"].includes(status)) order.verifiedAt ||= new Date();
  await order.save();
  if (["approved", "refunded"].includes(status)) {
    void notifyMasters({
      title: status === "refunded" ? "Estorno PagBank" :
        order.kind === "commission" ? "Comissão paga no PagBank" : "Pix recebido no PagBank",
      body: valid ? "Confirmação do PagBank registrada no Financeiro."
        : "Pagamento exige conciliação manual. Não libere repasse.",
      category: "financeiro", id: String(order.freightId)
    });
    if (status === "approved" && valid) {
      if (freight.driverId) void notifyAccounts([freight.driverId], {
        role: "motorista", title: order.kind === "commission" ? "Comissão quitada" : "Frete pago",
        body: "Pagamento confirmado pelo PagBank.", id: String(order.freightId)
      }).catch(() => {});
      if (order.kind === "freight") void notifyAccounts([freight.clientId], {
        role: "cliente", title: "Pix confirmado",
        body: "Pagamento confirmado pelo PagBank.", id: String(order.freightId)
      }).catch(() => {});
    }
  }
  return true;
}
export async function refreshPagBankOrder(order) {
  if (order.orderId && order.status !== "refunded") {
    if (order.environment !== process.env.PAGBANK_ENV)
      fail(409, "Cobrança criada em outro ambiente PagBank. Consulte a configuração original.");
    const remote = await pagbankRequest("GET", `/orders/${encodeURIComponent(order.orderId)}`);
    await syncPagBankOrder(order, remote);
  }
  return order;
}
export async function refundPagBankPayment(freight) {
  if (freight.paymentStatus !== "paid_pagbank")
    fail(409, "Este frete não possui Pix PagBank disponível para reembolso.");
  const order = await PagBankOrder.findOne({ freightId: freight._id, kind: "freight" });
  if (!order?.chargeId || order.amountCents !== freight.agreedPriceCents)
    fail(409, "Cobrança PagBank não conciliada.");
  if (order.status === "refunded")
    return { status: "CANCELED", amount: { summary: { refunded: order.amountCents } } };
  if (order.status !== "approved") fail(409, "O pagamento não está aprovado no PagBank.");
  const result = await pagbankRequest("POST", `/charges/${encodeURIComponent(order.chargeId)}/cancel`,
    { amount: { value: order.amountCents } }, `refund${order.idempotencyKey}`);
  if (result?.id !== order.chargeId ||
      Number(result.amount?.summary?.refunded || 0) < order.amountCents)
    fail(409, "Devolução ainda não confirmada pelo PagBank. Verifique antes de repetir.");
  order.status = "refunded";
  order.verifiedAt = new Date();
  await order.save();
  return result;
}

export async function pagBankCreate(req, res) {
  if (!pagBankEnabled()) fail(503, "PagBank ainda não configurado.");
  if (!mongoose.isValidObjectId(req.params.id)) fail(404, "Frete não encontrado.");
  const freight = await Freight.findById(req.params.id);
  const amountCents = canCreateMercadoPagoPix(freight, req.params.kind, req.user);
  const email = String(req.body?.email || "").trim().toLowerCase();
  const cpf = String(req.body?.cpf || "").replace(/\D/g, "");
  const phone = String(req.user.phone || "").replace(/\D/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)
    fail(400, "Informe um e-mail válido.");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf))
    fail(400, "Informe um CPF válido.");
  if (!/^\d{11}$/.test(phone)) fail(409, "Atualize seu celular no perfil.");
  let order = await PagBankOrder.findOne({ freightId: freight._id, kind: req.params.kind });
  if (!order) {
    try {
      order = await PagBankOrder.create({
        freightId: freight._id, kind: req.params.kind,
        payerId: String(req.user._id), amountCents,
        environment: process.env.PAGBANK_ENV,
        externalReference: `ft-${req.params.kind}-${randomUUID()}`,
        idempotencyKey: randomUUID().replaceAll("-", ""),
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      order = await PagBankOrder.findOne({ freightId: freight._id, kind: req.params.kind });
    }
  }
  if (!order || order.payerId !== String(req.user._id) || order.amountCents !== amountCents)
    fail(409, "Cobrança anterior divergente. Consulte a administração.");
  if (order.orderId) {
    await refreshPagBankOrder(order);
    return res.json(publicPagBankOrder(order));
  }
  if (order.attemptedAt)
    fail(409, "Pix em conciliação. Por segurança, peça ao Master para conferir antes de repetir.");
  const claim = await PagBankOrder.updateOne({
    _id: order._id, attemptedAt: null, orderId: ""
  }, { $set: { attemptedAt: new Date() } });
  if (!claim.modifiedCount) fail(409, "Geração de Pix em andamento.");
  const payload = {
    reference_id: order.externalReference,
    customer: {
      name: String(req.user.name).trim().slice(0,100),
      email, tax_id: cpf,
      phones: [{ type: "MOBILE", country: "55", area: phone.slice(0,2), number: phone.slice(2) }]
    },
    items: [{
      reference_id: order.externalReference.slice(0,60),
      name: order.kind === "freight" ? "Frete FreteOn" : "Comissao FreteOn",
      quantity: 1, unit_amount: amountCents
    }],
    charges: [{
      reference_id: order.externalReference,
      description: order.kind === "freight" ? "Frete contratado" : "Comissao de frete",
      amount: { value: amountCents, currency: "BRL" },
      payment_method: {
        type: "PIX", pix: { expiration_date: new Date(Date.now()+24*60*60*1000).toISOString() }
      }
    }],
    notification_urls: [`${process.env.PAGBANK_PUBLIC_URL.trim()}/api/pagbank/webhook`]
  };
  let result;
  try {
    result = await pagbankRequest("POST", "/orders", payload, order.idempotencyKey);
  } catch (error) {
    // HTTP 4xx definitivos indicam que não houve pedido. Um timeout ou 5xx
    // pode ter criado cobrança: nesse caso nunca liberar nova tentativa às cegas.
    if (error.pagbankDefinitiveRejection)
      await PagBankOrder.updateOne({ _id: order._id, orderId: "" },
        { $set: { attemptedAt: null } });
    throw error;
  }
  const charge = result?.charges?.[0];
  if (!/^ORDE_[A-Za-z0-9-]+$/.test(String(result?.id || "")) ||
      !/^CHAR_[A-Za-z0-9-]+$/.test(String(charge?.id || "")) ||
      charge.reference_id !== order.externalReference ||
      charge.amount?.value !== amountCents ||
      charge.amount?.currency !== "BRL" ||
      charge.payment_method?.type !== "PIX")
    fail(502, "Resposta PagBank incompleta. Consulte o Master.");
  order.orderId = result.id;
  order.chargeId = charge.id;
  order.status = "pending";
  order.qrCode = charge.qr_code?.text || "";
  order.expiresAt = charge.payment_method?.pix?.expiration_date
    ? new Date(charge.payment_method.pix.expiration_date) : null;
  await order.save();
  const qrId = charge.qr_code?.id;
  if (/^QRCO_[A-Fa-f0-9-]{36}$/.test(qrId || "")) {
    try {
      order.qrCodeBase64 = await pagbankRequest("GET", `/qrcode/${encodeURIComponent(qrId)}/png`,
        undefined, undefined, true);
      await order.save();
    } catch { /* Código copia-e-cola permanece disponível. */ }
  }
  await syncPagBankOrder(order, result);
  res.json(publicPagBankOrder(order));
}
export async function pagBankGet(req, res) {
  if (!pagBankEnabled()) fail(503, "PagBank ainda não configurado.");
  if (!mongoose.isValidObjectId(req.params.id)) fail(404, "Frete não encontrado.");
  const freight = await Freight.findById(req.params.id);
  if (!freight) fail(404, "Frete não encontrado.");
  if (!["freight", "commission"].includes(req.params.kind))
    fail(400, "Tipo de cobrança inválido.");
  const owner = req.params.kind === "freight" ? freight.clientId : freight.driverId;
  if (String(req.user._id) !== owner && req.user.role !== "master")
    fail(403, "Sem acesso a esta cobrança.");
  const order = await PagBankOrder.findOne({ freightId: freight._id, kind: req.params.kind });
  if (!order) return res.json({ status: "none", provider: "pagbank" });
  await refreshPagBankOrder(order);
  res.json(publicPagBankOrder(order));
}
export const pagBankWebhook = Router();
pagBankWebhook.post("/webhook", async (req, res) => {
  if (!pagBankEnabled()) return res.sendStatus(503);
  const authenticated = verifyPagBankWebhook(
    req.body, req.headers["x-payload-signature"],
    process.env.PAGBANK_WEBHOOK_PUBLIC_KEY
  ) || verifyLegacyPagBankWebhook(
    req.body, req.headers["x-authenticity-token"], process.env.PAGBANK_TOKEN
  );
  if (!authenticated) return res.sendStatus(401);
  let event;
  try { event = JSON.parse(req.body.toString("utf8")); }
  catch { return res.sendStatus(400); }
  const id = String(event?.id || event?.charges?.[0]?.id || "");
  const order = id.startsWith("CHAR_")
    ? await PagBankOrder.findOne({ chargeId: id })
    : id.startsWith("ORDE_")
      ? await PagBankOrder.findOne({ orderId: id }) : null;
  if (order) await refreshPagBankOrder(order);
  return res.sendStatus(204);
});
