import mongoose from "mongoose";
import { Router } from "express";
import { Account, Freight, Session, PushSubscription } from "./models.js";
import { authorize, fail } from "./auth.js";
import { isPrincipal } from "./teamAccess.js";

// Trilha específica de moderação: a justificativa não aparece no perfil público.
const moderationSchema = new mongoose.Schema({
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  targetRole: { type: String, enum: ["cliente", "motorista"], required: true },
  actorId: { type: String, required: true },
  action: { type: String, enum: ["block", "unblock"], required: true },
  reason: { type: String, required: true, maxlength: 500 },
}, { timestamps: true });
moderationSchema.index({ targetId: 1, createdAt: -1 });
const Moderation = mongoose.models.FreteOnAccountModeration ||
  mongoose.model("FreteOnAccountModeration", moderationSchema);

export const accountModeration = Router();
accountModeration.use("/master/accounts", authorize("master"), (req, _res, next) => {
  if (!isPrincipal(req.user)) fail(403, "A moderação de contas é exclusiva do Master Principal.");
  next();
});
const validId = id => {
  if (!mongoose.isValidObjectId(id)) fail(400, "Conta inválida.");
};
const nonAdmin = { $in: ["cliente", "motorista"] };
export function moderationMayProceed(activeFreight) {
  return !activeFreight || !["booked", "transit"].includes(activeFreight.status);
}
accountModeration.get("/master/accounts/:id/moderation", async (req, res) => {
  validId(req.params.id);
  const account = await Account.findOne({ _id: req.params.id, role: nonAdmin });
  if (!account) fail(404, "Cliente ou motorista não encontrado.");
  const events = await Moderation.find({ targetId: account._id })
    .sort({ createdAt: -1 }).limit(20).lean();
  res.json({
    id: String(account._id), blocked: Boolean(account.blockedAt),
    blockedAt: account.blockedAt, blockedReason: account.blockedReason || "",
    events: events.map(event => ({
      id: String(event._id), action: event.action,
      reason: event.reason, createdAt: event.createdAt,
    }))
  });
});
accountModeration.post("/master/accounts/:id/moderation", async (req, res) => {
  validId(req.params.id);
  const action = req.body?.action;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!["block", "unblock"].includes(action)) fail(400, "Ação de moderação inválida.");
  if (reason.length < 10 || reason.length > 500)
    fail(400, "Informe uma justificativa entre 10 e 500 caracteres.");
  const session = await mongoose.startSession();
  let response;
  try {
    await session.withTransaction(async () => {
      const account = await Account.findOne({ _id: req.params.id, role: nonAdmin }).session(session);
      if (!account) fail(404, "Somente contas de clientes e motoristas podem ser moderadas.");
      const blocking = action === "block";
      if (Boolean(account.blockedAt) === blocking)
        fail(409, blocking ? "Esta conta já está bloqueada." : "Esta conta já está ativa.");
      if (blocking) {
        // Evita impedir a entrega de frete contratado ou em andamento.
        const activeFreight = await Freight.findOne({
          status: { $in: ["booked", "transit"] },
          ...(account.role === "cliente" ? { clientId: String(account._id) } :
            { driverId: String(account._id) }),
        }).select("status").session(session);
        if (!moderationMayProceed(activeFreight))
          fail(409, "Há frete contratado ou em andamento. Resolva a operação antes de bloquear esta conta.");
        // Um cliente bloqueado não pode continuar publicando pedidos abertos.
        // A operação é atômica, não altera pedidos contratados nem pagamentos.
        if (account.role === "cliente") {
          await Freight.updateMany({ clientId: String(account._id), status: "open" },
            { $set: { status: "cancelled" } }, { session });
        }
        account.blockedAt = new Date();
        account.blockedBy = String(req.user._id);
        account.blockedReason = reason;
      } else {
        account.blockedAt = null;
        account.blockedBy = "";
        account.blockedReason = "";
      }
      await account.save({ session });
      await Moderation.create([{
        targetId: account._id, targetRole: account.role,
        actorId: String(req.user._id), action, reason,
      }], { session });
      if (blocking) {
        // Impede novas ações em qualquer sessão já aberta e desativa pushes.
        await Session.deleteMany({ userId: account._id }).session(session);
        await PushSubscription.deleteMany({ userId: String(account._id) }).session(session);
      }
      response = { ok: true, blocked: Boolean(account.blockedAt) };
    });
  } finally { await session.endSession(); }
  res.json(response);
});
