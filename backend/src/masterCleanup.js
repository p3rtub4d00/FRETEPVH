import { Router } from "express";
import mongoose from "mongoose";
import { Account, Session, Freight, FreightChat, FreightReport, PushSubscription } from "./models.js";
import { PagBankOrder } from "./pagBank.js";
import { MercadoPagoOrder } from "./mercadoPago.js";
import { authorize, fail } from "./auth.js";
import { isPrincipal } from "./teamAccess.js";

export const masterCleanup = Router();
masterCleanup.use(authorize("master"), (req, _res, next) => {
  if (!isPrincipal(req.user)) fail(403, "Somente o Master Principal pode excluir registros.");
  next();
});
masterCleanup.get("/master/cleanup", async (_req, res) => {
  const [clients, drivers, freights] = await Promise.all([
    Account.find({ role: "cliente" }).select("name phone").lean(),
    Account.find({ role: "motorista" }).select("name phone").lean(),
    Freight.find({}).select("title status paymentStatus commissionStatus payoutStatus refundStatus disputeStatus proposals selectedId clientId driverId").lean(),
  ]);
  res.json({
    clients: clients.map(a => ({ id: String(a._id), name: a.name, phone: a.phone })),
    drivers: drivers.map(a => ({ id: String(a._id), name: a.name, phone: a.phone })),
    freights: freights.map(f => ({ id: String(f._id), title: f.title, status: f.status, deletable: safeFreight(f) })),
  });
});
export function safeFreight(f) {
  return f.status === "open" && !f.selectedId && !f.driverId &&
    !(f.proposals?.length) && (f.paymentStatus || "none") === "none" &&
    (f.commissionStatus || "none") === "none" && (f.payoutStatus || "none") === "none" &&
    (f.refundStatus || "none") === "none" && (f.disputeStatus || "none") === "none";
}
// Exclusão permanente e limpeza dos dados associados devem ser atômicas.
// Sem transação, uma falha no meio da operação poderia deixar CNH, selfie ou
// solicitações de código órfãs após remover o cadastro.
async function inTransaction(action) {
  const session = await mongoose.startSession();
  try { await session.withTransaction(() => action(session)); }
  finally { await session.endSession(); }
}
export function driverDocumentIds(account) {
  const documents = account?.verification?.documents || [];
  return [...new Set(documents.map(doc => String(doc.fileId || ""))
    .filter(id => mongoose.isValidObjectId(id)))].map(id => new mongoose.Types.ObjectId(id));
}
masterCleanup.delete("/master/cleanup/:kind/:id", async (req, res) => {
  const { kind, id } = req.params;
  if (!["clients", "drivers", "freights"].includes(kind) || !mongoose.isValidObjectId(id))
    fail(400, "Registro inválido.");
  if (req.body?.confirmation !== "EXCLUIR") fail(400, "Confirme a exclusão digitando EXCLUIR.");
  if (kind === "freights") {
    await inTransaction(async session => {
      const freight = await Freight.findById(id).session(session);
      if (!freight) fail(404, "Chamado não encontrado.");
      if (!safeFreight(freight))
        fail(409, "Chamado com propostas, contratação ou movimentação financeira não pode ser excluído.");
      if (await PagBankOrder.exists({ freightId: freight._id }).session(session) ||
          await MercadoPagoOrder.exists({ freightId: freight._id }).session(session))
        fail(409, "Este chamado possui uma cobrança registrada. Preserve o histórico financeiro.");
      const removed = await Freight.deleteOne({
        _id: id, status: "open", selectedId: null, driverId: null,
        "proposals.0": { $exists: false }, paymentStatus: "none", commissionStatus: "none",
        payoutStatus: "none", refundStatus: "none", disputeStatus: "none"
      }).session(session);
      if (!removed.deletedCount) fail(409, "O chamado mudou de situação. Atualize a lista.");
      await FreightChat.deleteMany({ requestId: freight._id }).session(session);
      await FreightReport.deleteMany({ requestId: freight._id }).session(session);
    });
  } else {
    const role = kind === "clients" ? "cliente" : "motorista";
    await inTransaction(async session => {
      const account = await Account.findOne({ _id: id, role }).session(session);
      if (!account) fail(404, "Conta não encontrada.");
      const userId = String(account._id);
      const related = role === "cliente" ? { clientId: userId }
        : { $or: [{ driverId: userId }, { "proposals.driverId": userId }] };
      if (await Freight.exists(related).session(session))
        fail(409, "Esta conta possui chamados ou propostas vinculados. Preserve o histórico e resolva esses registros antes de excluir.");
      const removed = await Account.deleteOne({ _id: account._id, role }).session(session);
      if (!removed.deletedCount) fail(409, "Conta já excluída.");
      await Session.deleteMany({ userId: account._id }).session(session);
      await PushSubscription.deleteMany({ userId }).session(session);
      // Remover códigos de verificação e links de recuperação associados ao usuário.
      const db = mongoose.connection.db;
      await db.collection("freteonphoneverifications").deleteMany({ userId: account._id }, { session });
      await db.collection("freteonpasswordrecoveries").deleteMany({ userId: account._id }, { session });
      if (role === "motorista") {
        const ids = driverDocumentIds(account);
        if (ids.length) {
          await db.collection("private_driver_documents.chunks").deleteMany(
            { files_id: { $in: ids } }, { session });
          await db.collection("private_driver_documents.files").deleteMany(
            { _id: { $in: ids } }, { session });
        }
      }
    });
  }
  res.json({ ok: true });
});
