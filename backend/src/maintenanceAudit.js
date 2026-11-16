// Auditoria somente de leitura para avaliar uma limpeza de dados antes de lançar
// o FreteOn. Não registra nomes, documentos, telefones, tokens ou referências.
import { Account, Session, Freight, FreightChat, FreightReport, PushSubscription, PrivacyRequest } from "./models.js";
import { MercadoPagoOrder } from "./mercadoPago.js";
import { PagBankOrder } from "./pagBank.js";

export async function maintenancePreflight() {
  const opts = {
    realOrAmbiguousPayment: {
      $or: [
        { paymentStatus: { $in: ["paid_mp", "paid_pagbank", "refunded_mp", "refunded_pagbank"] } },
        { payoutStatus: "paid_manual" },
        { commissionStatus: "paid", commissionProviderEnvironment: { $ne: "sandbox" } },
        { paymentStatus: "received_driver" },
        { commissionStatus: "pending", paymentMethod: { $in: ["card_driver", "cash_driver"] } },
        { refundStatus: { $in: ["pending", "approved", "refunded_mp", "refunded_pagbank"] } }
      ]
    },
    commercialActive: {
      status: { $in: ["booked", "transit"] },
      paymentProviderEnvironment: { $ne: "sandbox" },
    }
  };
  const counts = Object.fromEntries(await Promise.all([
    ["clientes", Account.countDocuments({ role: "cliente" })],
    ["motoristas", Account.countDocuments({ role: "motorista" })],
    ["masters", Account.countDocuments({ role: "master" })],
    ["fretes", Freight.countDocuments({})],
    ["conversas", FreightChat.countDocuments({})],
    ["denuncias", FreightReport.countDocuments({})],
    ["sessoes", Session.countDocuments({})],
    ["pushSubscriptions", PushSubscription.countDocuments({})],
    ["privacidadeSolicitacoes", PrivacyRequest.countDocuments({})],
    ["mercadoPagoOrders", MercadoPagoOrder.countDocuments({})],
    ["mercadoPagoOrdersApproved", MercadoPagoOrder.countDocuments({ status: "approved" })],
    ["pagBankOrdersSandbox", PagBankOrder.countDocuments({ environment: "sandbox" })],
    ["pagBankOrdersProduction", PagBankOrder.countDocuments({ environment: "production" })],
    ["pagBankSandboxApproved", PagBankOrder.countDocuments({ environment: "sandbox", status: "approved" })],
    ["fretesFinanceirosRequeremPreservacao", Freight.countDocuments(opts.realOrAmbiguousPayment)],
    ["fretesAtivosForaHomologacao", Freight.countDocuments(opts.commercialActive)],
  ].map(async ([key, promise]) => [key, await promise])));
  const db = Account.db.db;
  const docs = await db.collection("private_driver_documents.files").countDocuments({});
  const chunks = await db.collection("private_driver_documents.chunks").countDocuments({});
  const collectionNames = (await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name);
  const report = {
    timestamp: new Date().toISOString(),
    counts: { ...counts, documentosMotoristas: docs, blocosDocumentoMotorista: chunks },
    collectionsRelacionadas: collectionNames.filter(x =>
      /freteon|account|session|freight|private_driver_documents|privacyrequest|pushsubscription/i.test(x)).sort(),
    paymentEnvironment: {
      mpEnabled: process.env.MP_PAYMENTS_ENABLED === "true",
      pagBankEnabled: process.env.PAGBANK_ENABLED === "true",
      pagBankEnvironment: process.env.PAGBANK_ENV === "production" ? "production" : "sandbox",
      pagBankProductionAllowed: process.env.PAGBANK_PRODUCTION_ALLOWED === "true"
    },
    excludeFromDeletionIfPresent: [
      "mercadoPagoOrders", "pagBankOrdersProduction",
      "fretesFinanceirosRequeremPreservacao", "fretesAtivosForaHomologacao"
    ].filter(key => counts[key] > 0),
  };
  report.safeToResetWithoutReview = report.excludeFromDeletionIfPresent.length === 0;
  return report;
}
