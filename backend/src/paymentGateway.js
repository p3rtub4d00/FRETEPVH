import { Router } from "express";
import mongoose from "mongoose";
import { fail } from "./auth.js";
import { MercadoPagoOrder, mercadoPagoCreateOrder, mercadoPagoGetOrder } from "./mercadoPago.js";
import { PagBankOrder, pagBankCreate, pagBankGet } from "./pagBank.js";
import { Freight } from "./models.js";
import { canCreateMercadoPagoPix } from "./mercadoPago.js";
import { AsaasOrder, asaasCreate, asaasGet } from "./asaas.js";
import { getPaymentProvider } from "./paymentProviderSettings.js";

const reservationSchema = new mongoose.Schema({ freightId: mongoose.Schema.Types.ObjectId, kind: String, provider: String }, { timestamps: true });
reservationSchema.index({ freightId: 1, kind: 1 }, { unique: true });
export const PaymentReservation = mongoose.models.FreteOnPaymentReservation || mongoose.model("FreteOnPaymentReservation", reservationSchema);
export const paymentGatewayRouter = Router();
export async function chooseGateway(req, reserve = false) {
  if (!mongoose.isValidObjectId(req.params.id) ||
      !["freight", "commission"].includes(req.params.kind))
    fail(404, "Frete ou modalidade inválida.");
  const conditions = { freightId: req.params.id, kind: req.params.kind };
  const [mp, pagbank, asaas, reservation] = await Promise.all([
    MercadoPagoOrder.exists(conditions), PagBankOrder.exists(conditions), AsaasOrder.exists(conditions), PaymentReservation.findOne(conditions).lean()
  ]);
  if ([mp, pagbank, asaas].filter(Boolean).length > 1)
    fail(409, "Cobranças em dois provedores identificadas. O Master precisa conferir antes de prosseguir.");
  if (mp) return "mercadopago";
  if (pagbank) return "pagbank";
  if (asaas) return "asaas";
  if (reservation) return reservation.provider;
  const config = await getPaymentProvider();
  if (!reserve) return config.preferred;
  const freight = await Freight.findById(req.params.id);
  canCreateMercadoPagoPix(freight, req.params.kind, req.user);
  if (!config.enabled) fail(503, "Banco selecionado ainda não configurado.");
  let selected;
  try { selected = await PaymentReservation.findOneAndUpdate(conditions,
    { $setOnInsert: { ...conditions, provider: config.preferred } }, { upsert: true, new: true }); }
  catch (error) { if (error.code !== 11000) throw error; selected = await PaymentReservation.findOne(conditions); }
  return selected.provider;
}
paymentGatewayRouter.post("/payments/orders/:id/:kind", async (req, res) => {
  const gateway = await chooseGateway(req, true);
  if (gateway === "asaas") return asaasCreate(req, res);
  if (gateway === "pagbank") return pagBankCreate(req, res);
  return mercadoPagoCreateOrder(req, res);
});
paymentGatewayRouter.get("/payments/orders/:id/:kind", async (req, res) => {
  const gateway = await chooseGateway(req);
  const config = await getPaymentProvider();
  if (!config.available[gateway])
    return res.json({ provider: gateway, status: "none", unavailable: true });
  if (gateway === "asaas") return asaasGet(req, res);
  if (gateway === "pagbank") return pagBankGet(req, res);
  return mercadoPagoGetOrder(req, res);
});
