import { randomUUID, createPublicKey, verify as verifySignature } from "node:crypto";
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
    if (!response.ok) fail(502, response.status === 403
      ? "PagBank recusou o acesso. Verifique a liberação da API de Pedidos."
      : "PagBank indisponível ou cobrança não autorizada.");
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
        commissionProvider: "pagbank" } });
      valid = Boolean(change.modifiedCount);
    } else {
      const change = await Freight.updateOne({
        _id: freight._id, clientId: order.payerId,
        paymentMethod: "pix_freteon", paymentStatus: "awaiting",
        agreedPriceCents: order.amountCents,
        status: { $in: ["booked", "transit", "completed", "cancelled"] }
      }, { $set: { paymentStatus: "paid_pagbank", paymentProvider: "pagbank" } });
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
