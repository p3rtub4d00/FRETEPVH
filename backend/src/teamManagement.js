import { Router } from "express";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { Account, Session } from "./models.js";
import { authorize, fail, hashPassword, phoneNumber, text } from "./auth.js";
import {
  TEAM_ROLES, TEAM_PERMISSIONS, TEAM_PERMISSION_KEYS, validateTeamPermissions,
  TeamAuditEvent, isPrincipal
} from "./teamAccess.js";

export const teamManagement = Router();
const ownerOnly = (req, _res, next) => {
  if (!isPrincipal(req.user)) fail(403, "Somente o Master Principal pode gerenciar a equipe.");
  next();
};
const publicStaff = account => ({
  id: String(account._id), name: account.name, phone: account.phone,
  teamRole: account.teamRole, permissions: account.staffPermissions || [],
  enabled: Boolean(account.staffEnabled),
  mustChangePassword: Boolean(account.mustChangePassword),
  createdAt: account.createdAt, updatedAt: account.updatedAt,
});
const temporaryPassword = () => randomBytes(18).toString("base64url");

teamManagement.get("/master/team", authorize("master"), ownerOnly, async (_req, res) => {
  const people = await Account.find({ role: "staff" }).sort({ createdAt: -1 });
  res.json({ items: people.map(publicStaff), presets: TEAM_ROLES, descriptions: TEAM_PERMISSIONS });
});
teamManagement.post("/master/team", authorize("master"), ownerOnly, async (req, res) => {
  const name = text(req.body?.name, 3, 100, "Nome");
  const phone = phoneNumber(req.body?.phone);
  const teamRole = String(req.body?.teamRole || "");
  const permissions = validateTeamPermissions(teamRole,
    req.body?.permissions ?? TEAM_ROLES[teamRole]?.permissions);
  if (await Account.exists({ phone })) fail(409, "Este telefone já pertence a uma conta FreteOn.");
  const password = temporaryPassword();
  const account = await Account.create({
    name, phone, passwordHash: await hashPassword(password),
    role: "staff", status: "approved", staffEnabled: true,
    teamRole, staffPermissions: permissions,
    mustChangePassword: true, staffCreatedBy: String(req.user._id)
  });
  // Senha entregue uma única vez; apenas o hash fica armazenado no MongoDB.
  res.status(201).json({ item: publicStaff(account), temporaryPassword: password });
});
teamManagement.patch("/master/team/:id", authorize("master"), ownerOnly, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) fail(400, "Funcionário inválido.");
  const staff = await Account.findOne({ _id: req.params.id, role: "staff" });
  if (!staff) fail(404, "Funcionário não encontrado.");
  const changes = {};
  if (Object.hasOwn(req.body, "name"))
    changes.name = text(req.body.name, 3, 100, "Nome");
  if (Object.hasOwn(req.body, "teamRole") || Object.hasOwn(req.body, "permissions")) {
    const role = req.body.teamRole ?? staff.teamRole;
    const perms = req.body.permissions ?? TEAM_ROLES[role]?.permissions;
    changes.teamRole = role;
    changes.staffPermissions = validateTeamPermissions(role, perms);
  }
  if (Object.hasOwn(req.body, "enabled")) {
    if (typeof req.body.enabled !== "boolean") fail(400, "Situação inválida.");
    changes.staffEnabled = req.body.enabled;
  }
  if (!Object.keys(changes).length) fail(400, "Nenhuma alteração informada.");
  const modified = await Account.findOneAndUpdate(
    { _id: staff._id, role: "staff" }, { $set: changes },
    { new: true, runValidators: true }
  );
  // Revogar sessões em qualquer mudança de função ou bloqueio.
  await Session.deleteMany({ userId: staff._id });
  res.json({ item: publicStaff(modified), sessionsRevoked: true });
});
teamManagement.post("/master/team/:id/reset-password", authorize("master"), ownerOnly, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) fail(400, "Funcionário inválido.");
  const staff = await Account.findOne({ _id: req.params.id, role: "staff" });
  if (!staff) fail(404, "Funcionário não encontrado.");
  const password = temporaryPassword();
  staff.passwordHash = await hashPassword(password);
  staff.mustChangePassword = true;
  await staff.save();
  await Session.deleteMany({ userId: staff._id });
  res.json({ item: publicStaff(staff), temporaryPassword: password });
});
teamManagement.get("/master/audit", authorize("master"), async (req, res) => {
  if (!isPrincipal(req.user) &&
      !req.user.staffPermissions?.includes("audit.view"))
    fail(403, "Sem permissão de auditoria.");
  const events = await TeamAuditEvent.find({}).sort({ createdAt: -1 }).limit(150).lean();
  const ids = [...new Set(events.map(x => x.actorId).filter(mongoose.isValidObjectId))];
  const users = await Account.find({ _id: { $in: ids } }).select("name").lean();
  const names = new Map(users.map(x => [String(x._id), x.name]));
  res.json({ items: events.map(x => ({
    id: String(x._id), actorId: x.actorId,
    name: names.get(x.actorId) || "Conta administrativa",
    level: x.actorRole, method: x.method,
    path: x.path, status: x.status, at: x.createdAt
  })) });
});
