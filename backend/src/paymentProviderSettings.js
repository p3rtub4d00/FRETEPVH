import { Router } from "express";
import mongoose from "mongoose";
import { authorize, fail } from "./auth.js";

const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  preferred: { type: String, enum: ["mercadopago", "pagbank", "asaas"], default: "mercadopago" },
  updatedBy: { type: String, default: "" }
}, { timestamps: true });

export const PaymentProviderSettings = mongoose.models.FreteOnPaymentProviderSettings ||
  mongoose.model("FreteOnPaymentProviderSettings", schema);

export const PAYMENT_PROVIDERS = ["mercadopago", "pagbank", "asaas"];
export function providerReady(provider) {
  if (provider === "mercadopago") return process.env.MP_PAYMENTS_ENABLED === "true" &&
    Boolean(process.env.MP_ACCESS_TOKEN?.trim()) &&
    Boolean(process.env.MP_WEBHOOK_SECRET?.trim()) &&
    /^https:\/\/[^/]+$/.test(process.env.MP_PUBLIC_URL?.trim() || "");
  if (provider === "pagbank") return process.env.PAGBANK_ENABLED === "true" &&
    Boolean(process.env.PAGBANK_TOKEN?.trim()) &&
    /^https:\/\/[^/]+$/.test(process.env.PAGBANK_PUBLIC_URL?.trim() || "") &&
    ["sandbox", "production"].includes(process.env.PAGBANK_ENV) &&
    (process.env.PAGBANK_ENV !== "production" || process.env.PAGBANK_PRODUCTION_ALLOWED === "true");
  if (provider === "asaas") return process.env.ASAAS_ENABLED === "true" &&
    process.env.ASAAS_ENV === "production" && Boolean(process.env.ASAAS_API_KEY?.trim()) &&
    !/PREENCHER|COLOQUE|sandbox|hmlg/i.test(process.env.ASAAS_API_KEY) &&
    /^[^\s]{32,255}$/.test(process.env.ASAAS_WEBHOOK_TOKEN || "") &&
    /^https:\/\/[^/]+$/.test(process.env.ASAAS_PUBLIC_URL || "");
  return false;
}
export async function getPaymentProvider() {
  // Nos testes unitários não existe banco; em produção a API bloqueia operações
  // financeiras quando o MongoDB estiver desconectado.
  const settings = mongoose.connection.readyState === 1
    ? await PaymentProviderSettings.findOne({ key: "global" }).lean() : null;
  const preferred = settings?.preferred || "mercadopago";
  return {
    preferred,
    enabled: providerReady(preferred),
    anyReady: PAYMENT_PROVIDERS.some(providerReady),
    real: providerReady(preferred) && (preferred !== "pagbank" || process.env.PAGBANK_ENV === "production"),
    available: {
      mercadopago: providerReady("mercadopago"),
      pagbank: providerReady("pagbank"),
      asaas: providerReady("asaas"),
    },
    pagbankEnvironment: process.env.PAGBANK_ENV === "production" ? "production" : "sandbox",
    testFlowEnabled: process.env.PAGBANK_ENV === "sandbox" &&
      process.env.PAGBANK_TEST_FLOW_ENABLED === "true" && providerReady("pagbank"),
    updatedAt: settings?.updatedAt || null,
  };
}
export const paymentProviderSettingsRouter = Router();
paymentProviderSettingsRouter.get("/master/payment-provider", authorize("master"), async (_req, res) => {
  res.json(await getPaymentProvider());
});
paymentProviderSettingsRouter.patch("/master/payment-provider", authorize("master"), async (req, res) => {
  const preferred = req.body?.preferred;
  if (!PAYMENT_PROVIDERS.includes(preferred))
    fail(400, "Escolha Mercado Pago, PagBank ou Asaas.");
  // O Master pode salvar uma preferência ainda não habilitada; cobranças reais
  // continuam bloqueadas até a configuração do servidor ficar completa.
  await PaymentProviderSettings.findOneAndUpdate(
    { key: "global" },
    { $set: { preferred, updatedBy: String(req.user._id) } },
    { upsert: true, runValidators: true }
  );
  res.json(await getPaymentProvider());
});
