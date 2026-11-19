// RESET ÚNICO do ambiente de homologação, autorizado pelo proprietário.
// Preserva registros anteriores em arquivo de auditoria protegido no MongoDB.
// Nunca executa com cobrança em produção, nem apaga Master/configurações.
// Operações de arquivo e remoção ocorrem na mesma transação MongoDB.
import mongoose from "mongoose";
import {
  Account, Session, Freight, FreightChat, FreightReport, PushSubscription
} from "./models.js";
import { MercadoPagoOrder } from "./mercadoPago.js";
import { PagBankOrder } from "./pagBank.js";
import { maintenancePreflight } from "./maintenanceAudit.js";

const BATCH_ID = "freteon-reset-homologacao-2026-11-16-v1";
const RESET_FLAG = "RESET_NONMASTER_HOMOLOGATION_ONCE";

export function resetPreflightAllowed(preflight) {
  return preflight.counts.masters === 1 &&
    !preflight.paymentEnvironment.asaasEnabled && !(preflight.counts.asaasOrders > 0) &&
    !preflight.paymentEnvironment.mpEnabled &&
    preflight.paymentEnvironment.pagBankEnvironment === "sandbox" &&
    !preflight.paymentEnvironment.pagBankProductionAllowed &&
    preflight.counts.mercadoPagoOrders === 0 &&
    preflight.counts.pagBankOrdersProduction === 0 &&
    preflight.counts.fretesAtivosForaHomologacao === 0;
}

export async function resetHomologationOnce() {
  if (process.env.FRETEON_RESET_TEST_DATA_ONCE !== RESET_FLAG) return;
  const preflight = await maintenancePreflight();
  if (!resetPreflightAllowed(preflight)) {
    console.error("FRETEON_RESET_BLOCKED " + JSON.stringify({
      masters: preflight.counts.masters,
      gateway: preflight.paymentEnvironment,
      mpOrders: preflight.counts.mercadoPagoOrders,
      pagbankProductionOrders: preflight.counts.pagBankOrdersProduction,
      activeOutsideSandbox: preflight.counts.fretesAtivosForaHomologacao
    }));
    return;
  }
  // A confirmação do banco nunca pode ser apagada de um frete classificado
  // como recebimento em produção, mesmo que o pedido externo esteja ausente.
  const hasActualBankMovement = await Freight.exists({
    $or: [
      { paymentStatus: { $in: ["paid_mp","refunded_mp","paid_asaas","refunded_asaas"] } },
      { paymentStatus: { $in: ["paid_pagbank","refunded_pagbank"] },
        paymentProviderEnvironment: { $ne: "sandbox" } },
      { commissionProvider: { $in: ["mercadopago", "asaas"] }, commissionStatus: "paid" },
      { commissionProvider: "pagbank", commissionStatus: "paid",
        commissionProviderEnvironment: { $ne: "sandbox" } },
      { refundStatus: { $in: ["refunded_mp", "refunded_asaas", "refunded_pagbank"] } }
    ]
  });
  if (hasActualBankMovement) {
    console.error("FRETEON_RESET_BLOCKED_REAL_PAYMENT_PRESENT");
    return;
  }

  const db = mongoose.connection.db;
  const archives = db.collection("freteon_maintenance_archive");
  const runs = db.collection("freteon_maintenance_runs");
  await archives.createIndex({ batch: 1, source: 1, originalId: 1 }, { unique: true });
  await runs.createIndex({ batch: 1 }, { unique: true });
  if (await runs.findOne({ batch: BATCH_ID })) {
    console.log("FRETEON_RESET_ALREADY_COMPLETED");
    return;
  }
  const users = await Account.find({ role: { $in: ["cliente", "motorista"] } })
    .select("_id").lean();
  const ids = users.map(x => x._id);
  // Nome da coleção original é armazenado para permitir restauração auditável.
  const steps = [
    { source: Account.collection.name, query: { role: { $in: ["cliente", "motorista"] } } },
    { source: Session.collection.name, query: { userId: { $in: ids } } },
    { source: Freight.collection.name, query: {} },
    { source: FreightChat.collection.name, query: {} },
    { source: FreightReport.collection.name, query: {} },
    { source: PushSubscription.collection.name, query: { role: { $in: ["cliente", "motorista"] } } },
    { source: PagBankOrder.collection.name, query: { environment: "sandbox" } },
    { source: "freteonpasswordrecoveries", query: { role: { $in: ["cliente", "motorista"] } } },
    { source: "freteonmasternotifications", query: {} },
    { source: "private_driver_documents.files", query: {} },
    { source: "private_driver_documents.chunks", query: {} }
  ];
  const session = await mongoose.startSession();
  const counts = {};
  try {
    await session.withTransaction(async () => {
      if (await runs.findOne({ batch: BATCH_ID }, { session }))
        throw new Error("Reset já executado.");
      for (const step of steps) {
        const source = db.collection(step.source);
        const records = await source.find(step.query, { session }).toArray();
        counts[step.source] = records.length;
        if (!records.length) continue;
        // Lotes pequenos preservam o limite de comandos BSON na transação.
        for (let index = 0; index < records.length; index += 10) {
          const items = records.slice(index, index + 10).map(original => ({
            batch: BATCH_ID, source: step.source,
            originalId: String(original._id), original, archivedAt: new Date()
          }));
          await archives.insertMany(items, { session, ordered: true });
        }
        await source.deleteMany(step.query, { session });
      }
      await runs.insertOne({ batch: BATCH_ID, completedAt: new Date(),
        counts, legacyFinancialItemsArchived: preflight.counts.fretesFinanceirosRequeremPreservacao,
        purpose: "reset ambiente de homologacao FreteOn, preservando Master e configuracoes" },
      { session });
    }, { readPreference: "primary", writeConcern: { w: "majority" } });
  } finally {
    await session.endSession();
  }
  const [clients, drivers, freights, admins] = await Promise.all([
    Account.countDocuments({ role: "cliente" }),
    Account.countDocuments({ role: "motorista" }),
    Freight.countDocuments({}),
    Account.countDocuments({ role: "master" })
  ]);
  console.log("FRETEON_RESET_COMPLETED " + JSON.stringify({
    batch: BATCH_ID, archivedAndRemoved: counts,
    after: { clients, drivers, freights, masters: admins }
  }));
}
