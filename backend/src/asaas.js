import { randomUUID, timingSafeEqual, createHash } from "node:crypto";
import mongoose from "mongoose";
import { Router } from "express";
import { Freight } from "./models.js";
import { fail } from "./auth.js";
import { providerReady } from "./paymentProviderSettings.js";
import { canCreateMercadoPagoPix, validCpf } from "./mercadoPago.js";
import { notifyInBackground, notifyMasters } from "./webPush.js";

const schema = new mongoose.Schema({
  freightId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  kind: { type: String, enum: ["freight", "commission"], required: true },
  payerId: { type: String, required: true },
  externalReference: { type: String, unique: true, required: true },
  amountCents: { type: Number, required: true, min: 100 },
  environment: { type: String, enum: ["production"], default: "production" },
  customerId: { type: String, default: "" },
  paymentId: { type: String, default: "", index: true },
  attemptedAt: { type: Date, default: null },
  refundAttemptedAt: { type: Date, default: null },
  status: { type: String, default: "created" },
  qrCode: { type: String, default: "" }, qrCodeBase64: { type: String, default: "" },
  expiresAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null }, reviewRequired: { type: Boolean, default: false }
}, { timestamps: true });
schema.index({ freightId: 1, kind: 1 }, { unique: true });
export const AsaasOrder = mongoose.models.FreteOnAsaasOrder || mongoose.model("FreteOnAsaasOrder", schema);
const eventSchema = new mongoose.Schema({
  eventId: { type: String, unique: true, required: true },
  paymentId: String, externalReference: String,
  completedAt: { type: Date, default: null },
  nextAttemptAt: { type: Date, default: Date.now }, attempts: { type: Number, default: 0 }
}, { timestamps: true });
eventSchema.index({ completedAt: 1, nextAttemptAt: 1 });
export const AsaasEvent = mongoose.models.FreteOnAsaasEvent || mongoose.model("FreteOnAsaasEvent", eventSchema);
export const asaasEnabled = () => providerReady("asaas");
const paymentIdValid = id => /^pay_[A-Za-z0-9_-]{1,100}$/.test(String(id || ""));

export async function asaasRequest(method, path, payload) {
  if (!asaasEnabled()) fail(503, "Asaas de produção ainda não configurado.");
  try {
    const response = await fetch(`https://api.asaas.com/v3${path}`, {
      method, redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { access_token: process.env.ASAAS_API_KEY.trim(),
        "User-Agent": "FreteOn/1.0", Accept: "application/json", "Content-Type": "application/json" },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
    });
    if (!response.ok) {
      const error = new Error(response.status === 401 || response.status === 403
        ? "Asaas recusou o acesso. Confira a chave de produção e suas permissões."
        : "Asaas não autorizou a operação. Confira a cobrança e os dados no banco.");
      error.status = 502;
      error.definitive = [400, 401, 403, 422].includes(response.status);
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (error.status) throw error;
    fail(502, "Não foi possível confirmar a resposta do Asaas. Consulte o pagamento antes de repetir.");
  }
}

const webhookEvents = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_REFUNDED", "PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS", "PAYMENT_REFUND_DENIED", "PAYMENT_DELETED", "PAYMENT_UPDATED"];
let webhookUntil = 0, webhookPending;
export async function ensureAsaasWebhook() {
  if (webhookUntil > Date.now()) return;
  if (webhookPending) return webhookPending;
  webhookPending = (async () => {
    const url = `${process.env.ASAAS_PUBLIC_URL}/api/asaas/webhook`;
    const list = await asaasRequest("GET", "/webhooks?limit=100");
    const existing = list.data?.find(item => item.url === url);
    // Read only: never change the Asaas account's commercial data.
    const email = process.env.ASAAS_WEBHOOK_EMAIL?.trim() || existing?.email ||
      (await asaasRequest("GET", "/myAccount/commercialInfo/")).email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || ""))
      fail(503, "Configure ASAAS_WEBHOOK_EMAIL no Render para ativar a confirmação automática.");
    const body = { name: "FreteOn produção", url, email, enabled: true, interrupted: false,
      authToken: process.env.ASAAS_WEBHOOK_TOKEN, sendType: "SEQUENTIALLY", events: webhookEvents };
    await asaasRequest(existing ? "PUT" : "POST", existing ? `/webhooks/${encodeURIComponent(existing.id)}` : "/webhooks", body);
    webhookUntil = Date.now() + 5 * 60 * 1000;
  })();
  try { await webhookPending; } finally { webhookPending = null; }
}
export const publicAsaasOrder = order => ({ provider: "asaas", kind: order.kind, status: order.status,
  amountCents: order.amountCents, paymentId: order.paymentId,
  qrCode: ["pending", "created"].includes(order.status) ? order.qrCode : "",
  qrCodeBase64: ["pending", "created"].includes(order.status) ? order.qrCodeBase64 : "",
  expiresAt: order.expiresAt, reviewRequired: order.reviewRequired });

export function validateAsaasPayment(order, remote) {
  return order.environment === "production" && paymentIdValid(remote?.id) &&
    (!order.paymentId || remote.id === order.paymentId) &&
    remote.externalReference === order.externalReference && remote.customer === order.customerId &&
    remote.billingType === "PIX" && typeof remote.value === "number" &&
    Math.round(remote.value * 100) === order.amountCents;
}
export function asaasPaymentStatus(remote) {
  const refunds = remote.refunds || [];
  const done = refunds.filter(x => x.status === "DONE").reduce((sum, x) => sum + Math.round(Number(x.value) * 100), 0);
  if (remote.status === "REFUNDED" && done >= Math.round(remote.value * 100)) return "refunded";
  if (refunds.length || /REFUND|CHARGEBACK/.test(remote.status)) return "review";
  // CONFIRMED can still be blocked for a Pix. Only settled funds count.
  if (remote.status === "RECEIVED") return "approved";
  if (remote.deleted) return "cancelled";
  return "pending";
}

export async function syncAsaasOrder(order, remote) {
  if (!validateAsaasPayment(order, remote)) fail(409, "Divergência na cobrança Asaas. Consulte o Master.");
  const status = asaasPaymentStatus(remote);
  const session = await mongoose.startSession();
  let changed = false, valid = false;
  try {
    await session.withTransaction(async () => {
      changed = false; valid = false;
      const current = await AsaasOrder.findById(order._id).session(session);
      if (!current) fail(409, "Cobrança não encontrada.");
      if (current.status === "refunded" || (current.status === "approved" && status === "pending")) return;
      if (current.status === status && current.paymentId) return;
      const freight = await Freight.findById(order.freightId).session(session);
      if (!freight) fail(409, "Frete da cobrança não encontrado.");
      if (status === "approved") {
        if (order.kind === "freight") {
          valid = freight.clientId === order.payerId && freight.agreedPriceCents === order.amountCents &&
            freight.paymentMethod === "pix_freteon" && freight.paymentStatus === "awaiting" &&
            ["booked", "transit", "completed"].includes(freight.status) && !["pending", "approved"].includes(freight.refundStatus);
          if (valid) { freight.paymentStatus = "paid_asaas"; freight.paymentProvider = "asaas"; freight.paymentProviderEnvironment = "production"; }
        } else {
          valid = freight.driverId === order.payerId && freight.commissionCents === order.amountCents &&
            ["cash_driver", "card_driver"].includes(freight.paymentMethod) && freight.commissionStatus === "pending" &&
            freight.disputeStatus !== "open" && !["pending", "approved"].includes(freight.refundStatus);
          if (valid) { freight.commissionStatus = "paid"; freight.commissionPaidAt = new Date(); freight.commissionProvider = "asaas"; freight.commissionProviderEnvironment = "production"; }
        }
      } else if (status === "refunded" && order.kind === "freight") {
        valid = freight.clientId === order.payerId && freight.paymentStatus === "paid_asaas" &&
          !["paid_manual", "paid_simulated"].includes(freight.payoutStatus);
        if (valid) {
          freight.paymentStatus = "refunded_asaas"; freight.refundStatus = "refunded_asaas";
          freight.refundedAt = new Date(); freight.refundAmountCents = order.amountCents;
          freight.status = "cancelled"; freight.payoutStatus = "none";
          freight.commissionStatus = "waived"; freight.commissionDueAt = null;
        }
      }
      const review = status === "review" || (["approved", "refunded"].includes(status) && !valid);
      if (review) {
        // An external partial refund or unexpected credit must never unlock a payout.
        freight.disputeStatus = "open";
        freight.disputeReason = "Movimentação Asaas requer conciliação no banco antes de liberar valores.";
        if (!["paid_manual", "paid_simulated"].includes(freight.payoutStatus)) freight.payoutStatus = "none";
      }
      await freight.save({ session });
      current.paymentId = remote.id; current.status = status; current.reviewRequired = review;
      if (["approved", "refunded"].includes(status)) current.verifiedAt ||= new Date();
      await current.save({ session });
      changed = true;
    });
  } finally { await session.endSession(); }
  Object.assign(order, await AsaasOrder.findById(order._id).lean());
  if (changed && ["approved", "refunded", "review"].includes(status)) {
    void notifyMasters({ title: status === "refunded" ? "Estorno Asaas confirmado" : status === "approved" ? "Pix recebido no Asaas" : "Asaas: conferir movimentação",
      body: valid ? "Confirmação registrada no Financeiro." : "Confira a cobrança no Asaas antes de liberar valores.", category: "financeiro", id: String(order.freightId) });
    if (valid) {
      const freight = await Freight.findById(order.freightId).lean();
      for (const [id, role] of [[freight.clientId, "cliente"], [freight.driverId, "motorista"]])
        notifyInBackground([id], { role, title: status === "refunded" ? "Reembolso confirmado" : "Pix confirmado", body: "O Asaas confirmou a operação. Confira no FreteOn.", id: `${order._id}-${status}` });
    }
  }
  return order;
}
export async function refreshAsaasOrder(order) {
  let remote;
  if (order.paymentId) remote = await asaasRequest("GET", `/payments/${encodeURIComponent(order.paymentId)}`);
  else if (order.attemptedAt) {
    const list = await asaasRequest("GET", `/payments?externalReference=${encodeURIComponent(order.externalReference)}&limit=100`);
    const matches = (list.data || []).filter(x => x.externalReference === order.externalReference);
    if (matches.length > 1) fail(409, "Mais de uma cobrança localizada. Confira no Asaas.");
    remote = matches[0];
  }
  if (remote) await syncAsaasOrder(order, remote);
  if (order.paymentId && order.status === "pending" && !order.qrCode) {
    const qr = await asaasRequest("GET", `/payments/${encodeURIComponent(order.paymentId)}/pixQrCode`);
    order.qrCode = String(qr.payload || "").slice(0, 5000);
    order.qrCodeBase64 = /^[A-Za-z0-9+/=]+$/.test(qr.encodedImage || "") && qr.encodedImage.length < 200000 ? qr.encodedImage : "";
    order.expiresAt = qr.expirationDate ? new Date(qr.expirationDate) : null;
    // Only QR fields: do not overwrite a concurrent webhook settlement.
    await AsaasOrder.updateOne({ _id: order._id }, { $set: {
      qrCode: order.qrCode, qrCodeBase64: order.qrCodeBase64, expiresAt: order.expiresAt
    } });
  }
  return order;
}
export async function asaasCreate(req, res) {
  const freight = await Freight.findById(req.params.id);
  const amountCents = canCreateMercadoPagoPix(freight, req.params.kind, req.user);
  const cpf = String(req.body?.cpf || "").replace(/\D/g, "");
  const email = String(req.body?.email || "").trim();
  if (!validCpf(cpf) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) fail(400, "Informe CPF e e-mail válidos.");
  await ensureAsaasWebhook();
  let order = await AsaasOrder.findOne({ freightId: freight._id, kind: req.params.kind });
  if (!order) {
    try { order = await AsaasOrder.create({ freightId: freight._id, kind: req.params.kind, payerId: String(req.user._id), amountCents, externalReference: `freteon-${randomUUID()}` }); }
    catch (error) { if (error.code !== 11000) throw error; order = await AsaasOrder.findOne({ freightId: freight._id, kind: req.params.kind }); }
  }
  if (order.payerId !== String(req.user._id) || order.amountCents !== amountCents) fail(409, "Cobrança divergente. Consulte o Master.");
  if (order.attemptedAt || order.paymentId) {
    await refreshAsaasOrder(order);
    if (!order.paymentId) fail(409, "Geração em conciliação no Asaas. Não gere outro Pix; consulte o Master.");
    return res.json(publicAsaasOrder(order));
  }
  const claim = await AsaasOrder.updateOne({ _id: order._id, attemptedAt: null }, { $set: { attemptedAt: new Date() } });
  if (!claim.modifiedCount) fail(409, "Geração de Pix em andamento.");
  // No automatic retries of POSTs: ambiguous responses are reconciled by reference.
  let customer;
  try {
  const customers = await asaasRequest("GET", `/customers?cpfCnpj=${encodeURIComponent(cpf)}&externalReference=${encodeURIComponent(order.payerId)}&limit=100`);
  customer = customers.data?.find(x => x.externalReference === order.payerId && String(x.cpfCnpj).replace(/\D/g, "") === cpf);
  if (!customer) customer = await asaasRequest("POST", "/customers", { name: req.user.name, cpfCnpj: cpf, email,
    mobilePhone: req.user.phone, externalReference: order.payerId, notificationDisabled: true });
  if (!/^cus_[A-Za-z0-9_-]+$/.test(customer?.id || "")) fail(502, "Cadastro Asaas incompleto.");
  order.customerId = customer.id; await order.save();
  } catch (error) {
    // No payment POST occurred. A repeated customer lookup recovers a timeout.
    await AsaasOrder.updateOne({ _id: order._id, paymentId: "" }, { $set: { attemptedAt: null } });
    throw error;
  }
  let remote;
  try {
  remote = await asaasRequest("POST", "/payments", { customer: customer.id, billingType: "PIX",
    value: amountCents / 100, dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    externalReference: order.externalReference, description: order.kind === "freight" ? "Frete FreteOn" : "Comissão FreteOn",
    fine: { value: 0 }, interest: { value: 0 } });
  } catch (error) {
    if (error.definitive) await AsaasOrder.updateOne({ _id: order._id, paymentId: "" }, { $set: { attemptedAt: null } });
    throw error;
  }
  await syncAsaasOrder(order, remote);
  await refreshAsaasOrder(order);
  res.json(publicAsaasOrder(order));
}
export async function asaasGet(req, res) {
  const freight = await Freight.findById(req.params.id);
  if (!freight) fail(404, "Frete não encontrado.");
  if (req.user.role !== "master" && String(req.user._id) !== (req.params.kind === "freight" ? freight.clientId : freight.driverId)) fail(403, "Sem acesso à cobrança.");
  const order = await AsaasOrder.findOne({ freightId: freight._id, kind: req.params.kind });
  if (!order) return res.json({ provider: "asaas", status: "none" });
  await refreshAsaasOrder(order); res.json(publicAsaasOrder(order));
}
export async function refundAsaasPayment(freight) {
  const order = await AsaasOrder.findOne({ freightId: freight._id, kind: "freight" });
  if (!order?.paymentId || order.amountCents !== freight.agreedPriceCents) fail(409, "Cobrança Asaas não conciliada.");
  await refreshAsaasOrder(order);
  if (order.status === "refunded") return;
  if (order.refundAttemptedAt) return; // Poll/webhook confirms an uncertain request; never issue twice.
  if (order.status !== "approved" || order.reviewRequired) fail(409, "Confira o pagamento no Asaas antes de estornar.");
  const claim = await AsaasOrder.updateOne({ _id: order._id, refundAttemptedAt: null }, { $set: { refundAttemptedAt: new Date() } });
  if (!claim.modifiedCount) return;
  try {
    await asaasRequest("POST", `/payments/${encodeURIComponent(order.paymentId)}/refund`, { value: order.amountCents / 100, description: "Reembolso aprovado pelo FreteOn" });
  } catch (error) {
    if (error.definitive) await AsaasOrder.updateOne({ _id: order._id }, { $set: { refundAttemptedAt: null } });
    throw error;
  }
  await refreshAsaasOrder(order);
}
export function verifyAsaasWebhook(token, secret = process.env.ASAAS_WEBHOOK_TOKEN) {
  if (typeof token !== "string" || !secret || secret.length < 32 || token.length > 255) return false;
  return timingSafeEqual(createHash("sha256").update(token).digest(), createHash("sha256").update(secret).digest());
}
export const asaasWebhook = Router();
asaasWebhook.post("/webhook", async (req, res) => {
  if (!verifyAsaasWebhook(req.get("asaas-access-token"))) return res.sendStatus(401);
  const event = req.body;
  if (!/^evt_[A-Za-z0-9_-]{1,180}$/.test(event?.id || "") || !paymentIdValid(event.payment?.id)) return res.sendStatus(400);
  try { await AsaasEvent.create({ eventId: event.id, paymentId: event.payment.id, externalReference: String(event.payment.externalReference || "").slice(0, 150) }); }
  catch (error) { if (error.code !== 11000) throw error; }
  res.sendStatus(200); // Durable receipt before acknowledgment; the worker queries Asaas itself.
  void processAsaasEvents().catch(() => console.warn("Asaas: conciliação pendente."));
});
let working = false;
export async function processAsaasEvents() {
  if (working || !asaasEnabled()) return;
  working = true;
  try {
    const events = await AsaasEvent.find({ completedAt: null, nextAttemptAt: { $lte: new Date() } }).sort({ nextAttemptAt: 1 }).limit(10);
    for (const event of events) {
      try {
        const order = await AsaasOrder.findOne({ $or: [{ paymentId: event.paymentId }, { externalReference: event.externalReference }] });
        if (order) { await refreshAsaasOrder(order); if (!order.paymentId) throw new Error("Payment pending reconciliation"); }
        event.completedAt = new Date();
      } catch { event.attempts++; event.nextAttemptAt = new Date(Date.now() + Math.min(3600000, 15000 * 2 ** Math.min(event.attempts, 8))); }
      await event.save();
    }
  } finally { working = false; }
}
