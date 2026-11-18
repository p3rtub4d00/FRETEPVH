import { Router } from "express";
import mongoose from "mongoose";
import { Account, Session, Freight, FreightChat, FreightReport, PushSubscription } from "./models.js";
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
function safeFreight(f) {
  return f.status === "open" && !f.selectedId && !f.driverId &&
    !(f.proposals?.length) && (f.paymentStatus || "none") === "none" &&
    (f.commissionStatus || "none") === "none" && (f.payoutStatus || "none") === "none" &&
    (f.refundStatus || "none") === "none" && (f.disputeStatus || "none") === "none";
}
masterCleanup.delete("/master/cleanup/:kind/:id", async (req, res) => {
  const { kind, id } = req.params;
  if (!["clients", "drivers", "freights"].includes(kind) || !mongoose.isValidObjectId(id))
    fail(400, "Registro inválido.");
  if (req.body?.confirmation !== "EXCLUIR") fail(400, "Confirme a exclusão digitando EXCLUIR.");
  if (kind === "freights") {
    const freight = await Freight.findById(id);
    if (!freight) fail(404, "Chamado não encontrado.");
    if (!safeFreight(freight)) fail(409, "Chamado com propostas, contratação ou movimentação financeira não pode ser excluído.");
    const removed = await Freight.deleteOne({ _id: id, status: "open", selectedId: null, driverId: null, "proposals.0": { $exists: false }, paymentStatus: "none", commissionStatus: "none", payoutStatus: "none", refundStatus: "none", disputeStatus: "none" });
    if (!removed.deletedCount) fail(409, "O chamado mudou de situação. Atualize a lista.");
    await Promise.all([FreightChat.deleteMany({ requestId: id }), FreightReport.deleteMany({ requestId: id })]);
  } else {
    const role = kind === "clients" ? "cliente" : "motorista";
    const account = await Account.findOne({ _id: id, role });
    if (!account) fail(404, "Conta não encontrada.");
    const userId = String(account._id);
    const related = role === "cliente"
      ? { clientId: userId }
      : { $or: [{ driverId: userId }, { "proposals.driverId": userId }] };
    if (await Freight.exists(related))
      fail(409, "Esta conta possui chamados ou propostas vinculados. Preserve o histórico e resolva esses registros antes de excluir.");
    const removed = await Account.deleteOne({ _id: id, role });
    if (!removed.deletedCount) fail(409, "Conta já excluída.");
    await Promise.all([Session.deleteMany({ userId: account._id }), PushSubscription.deleteMany({ userId })]);
  }
  res.json({ ok: true });
});
