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
