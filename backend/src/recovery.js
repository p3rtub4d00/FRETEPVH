import { Router } from "express";
import { randomBytes, randomInt, createHash, timingSafeEqual } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { Account, Session } from "./models.js";
import { authenticate, authorize, hashPassword, phoneNumber, fail } from "./auth.js";

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
  role: { type: String, enum: ["cliente", "motorista"], required: true },
  phone: { type: String, required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ["pending", "issued", "used", "cancelled"], default: "pending" },
  tokenHash: { type: String, default: "" },
  codeHash: { type: String, default: "" },
  expiresAt: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
  issuedAt: Date, usedAt: Date, issuedBy: String
}, { timestamps: true });
schema.index({ status: 1, createdAt: -1 });
schema.index({ userId: 1, status: 1 });
const Recovery = mongoose.models.FreteOnPasswordRecovery || mongoose.model("FreteOnPasswordRecovery", schema);
const sha = v => createHash("sha256").update(v).digest("hex");
const limiter = (limit) => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Muitas tentativas. Aguarde alguns minutos." } });
export const recovery = Router();

recovery.post("/request", limiter(8), async (req, res) => {
  const role = req.body?.role;
  if (!["cliente", "motorista"].includes(role)) fail(400, "Perfil inválido.");
  const phone = phoneNumber(req.body?.phone);
  const user = await Account.findOne({ phone, role });
  if (user) {
    const recent = await Recovery.findOne({ userId: user._id, createdAt: { $gt: new Date(Date.now() - 5 * 60_000) }, status: { $in: ["pending", "issued"] } });
    if (!recent) await Recovery.create({ userId: user._id, role, phone, name: user.name });
  }
  res.json({ message: "Se os dados estiverem cadastrados, a solicitação será encaminhada ao administrador." });
});

recovery.get("/master", authenticate, authorize("master"), async (_req, res) => {
  const items = await Recovery.find({ status: { $in: ["pending", "issued"] } }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ items: items.map(x => ({ id: String(x._id), name: x.name, phone: x.phone, role: x.role, status: x.status, createdAt: x.createdAt, expiresAt: x.expiresAt })) });
});
recovery.post("/master/:id/issue", authenticate, authorize("master"), limiter(30), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) fail(400, "Solicitação inválida.");
  const token = randomBytes(32).toString("hex");
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + 30 * 60_000);
  const item = await Recovery.findOneAndUpdate({ _id: req.params.id, status: { $in: ["pending", "issued"] } }, {
    $set: { status: "issued", tokenHash: sha(token), codeHash: sha(code), expiresAt, attempts: 0, issuedAt: new Date(), issuedBy: String(req.user._id) }
  }, { new: true });
  if (!item) fail(404, "Solicitação não encontrada ou concluída.");
  const origin = process.env.PUBLIC_APP_URL;
  const base = origin && /^https:\/\/[^/]+\/?$/.test(origin) ? origin.replace(/\/$/, "") : `${req.protocol}://${req.get("host")}`;
  res.json({ link: `${base}/recuperar-senha?token=${token}`, code, expiresAt, phone: item.phone, name: item.name });
});
recovery.post("/master/:id/cancel", authenticate, authorize("master"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) fail(400, "Solicitação inválida.");
  await Recovery.updateOne({ _id: req.params.id, status: { $in: ["pending", "issued"] } }, { $set: { status: "cancelled", tokenHash: "", codeHash: "" } });
  res.json({ ok: true });
});
recovery.post("/reset", limiter(12), async (req, res) => {
  const { token, code, password } = req.body || {};
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || typeof code !== "string" || !/^\d{6}$/.test(code)) fail(400, "Link ou código inválido.");
  const tokenHash = sha(token);
  const item = await Recovery.findOne({ tokenHash, status: "issued", expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } });
  if (!item) fail(400, "Link expirado ou inválido. Solicite outro.");
  const supplied = Buffer.from(sha(code), "hex");
  const expected = Buffer.from(item.codeHash, "hex");
  if (!timingSafeEqual(supplied, expected)) {
    await Recovery.updateOne({ _id: item._id, status: "issued" }, { $inc: { attempts: 1 } });
    fail(400, "Código incorreto ou limite de tentativas atingido.");
  }
  const passwordHash = await hashPassword(password);
  const claimed = await Recovery.findOneAndUpdate({ _id: item._id, status: "issued", tokenHash, codeHash: sha(code), expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $set: { status: "used", usedAt: new Date(), tokenHash: "", codeHash: "" } });
  if (!claimed) fail(400, "Este link já foi utilizado.");
  await Account.updateOne({ _id: item.userId, role: item.role }, { $set: { passwordHash } });
  await Session.deleteMany({ userId: item.userId });
  await Recovery.updateMany({ userId: item.userId, status: { $in: ["pending", "issued"] } }, { $set: { status: "cancelled", tokenHash: "", codeHash: "" } });
  res.json({ message: "Senha alterada. Entre novamente com sua nova senha." });
});
