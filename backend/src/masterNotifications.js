import mongoose from "mongoose";
import { Router } from "express";
import { authorize, fail } from "./auth.js";
import { masterCategories } from "./masterNotificationAccess.js";
const schema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 90 },
  body: { type: String, required: true, maxlength: 180 },
  category: { type: String, enum: ["motoristas","fretes","financeiro","recuperacao","denuncias","verificacao-telefone","geral"], default: "geral" },
  targetId: { type: String, default: "" },
  readBy: { type: [String], default: [] }
}, { timestamps: true });
schema.index({ createdAt: -1 });
const Event = mongoose.models.FreteOnMasterNotification || mongoose.model("FreteOnMasterNotification", schema);
export async function recordMasterNotification(message) {
  const title = String(message.title || "Aviso FreteOn").slice(0,90);
  const body = String(message.body || "Há uma nova ocorrência.").slice(0,180);
  const category = ["motoristas","fretes","financeiro","recuperacao","denuncias","verificacao-telefone","geral"].includes(message.category) ? message.category : "geral";
  return Event.create({ title, body, category, targetId: String(message.id || "").slice(0,80) });
}
export const masterNotifications = Router();
// Autorização aplicada apenas às rotas Master; não bloquear demais rotas da API.
masterNotifications.get("/master/notifications", authorize("master"), async (req,res) => {
  const filter = { category: { $in: masterCategories(req.user) } };
  const userId = String(req.user._id);
  const [events, counts] = await Promise.all([
    Event.find(filter).sort({ createdAt:-1, _id:-1 }).limit(100).lean(),
    Event.aggregate([{ $match: { ...filter, readBy: { $ne: userId } } },
      { $group: { _id: "$category", count: { $sum: 1 } } }])
  ]);
  res.setHeader("Cache-Control", "no-store, private");
  res.json({ unread: counts.reduce((sum, row) => sum + row.count, 0),
    unreadByCategory: Object.fromEntries(counts.map(row => [row._id, row.count])),
    items: events.map(event => ({
      id: String(event._id), title: event.title, body: event.body,
      category: event.category, targetId: event.targetId,
      createdAt: event.createdAt, read: (event.readBy || []).includes(userId)
    })) });
});
masterNotifications.post("/master/notifications/:id/read", authorize("master"), async (req,res) => {
  if (!mongoose.isValidObjectId(req.params.id)) fail(400,"Aviso inválido.");
  await Event.updateOne({ _id:req.params.id, category: { $in: masterCategories(req.user) } }, { $addToSet: { readBy: String(req.user._id) } });
  res.json({ ok:true });
});
masterNotifications.post("/master/notifications/read-all", authorize("master"), async (req,res) => {
  const before = req.body?.before;
  if (!mongoose.isValidObjectId(before)) fail(400, "Atualize a lista antes de marcar os avisos.");
  await Event.updateMany({ _id: { $lte: new mongoose.Types.ObjectId(before) }, category: { $in: masterCategories(req.user) }, readBy: { $ne: String(req.user._id) } }, { $addToSet: { readBy: String(req.user._id) } });
  res.json({ ok:true });
});
