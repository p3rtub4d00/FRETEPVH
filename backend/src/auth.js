import {
  randomBytes,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { Account, Session, publicUser } from "./models.js";

const scrypt = promisify(scryptCallback);
const cookieName = "freteon_session"; // Compatibilidade com sessões anteriores.
const roles = ["cliente", "motorista", "master"];
const roleCookieName = (role) => `freteon_session_${role}`;
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production" || Boolean(process.env.RENDER),
  path: "/",
};
export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function text(value, min, max, label) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `${label}: informe entre ${min} e ${max} caracteres.`);
  return value.trim();
}
export function phoneNumber(value) {
  let phone = typeof value === "string" ? value.replace(/\D/g, "") : "";
  if (phone.length === 13 && phone.startsWith("55")) phone = phone.slice(2);
  if (!/^[1-9]{2}9\d{8}$/.test(phone))
    fail(400, "Informe um celular com DDD e 11 dígitos.");
  return phone;
}
export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    fail(400, "A senha deve ter de 8 a 128 caracteres.");
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}
async function verifyPassword(password, stored) {
  if (typeof password !== "string" || password.length > 128) return false;
  const [salt, hash] = stored.split(":");
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
const digest = (token) => createHash("sha256").update(token).digest("hex");
const validToken = (token) => typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
const requestedRole = (req) => {
  const role = req.get("X-FreteOn-Role");
  if (!roles.includes(role)) fail(400, "Selecione Cliente, Motorista ou Master.");
  return role;
};

async function findSessionUser(token) {
  if (!validToken(token)) return null;
  const session = await Session.findOne({
    tokenHash: digest(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;
  return Account.findById(session.userId);
}

async function sessionForRole(req, role) {
  // Cada perfil exige sua própria sessão real, autenticada no servidor.
  const active = await findSessionUser(req.cookies[roleCookieName(role)]);
  if (active?.role === role) return active;
  // Permite migrar uma sessão antiga sem exigir novo login.
  const previous = await findSessionUser(req.cookies[cookieName]);
  return previous?.role === role ? previous : null;
}

async function issueSession(req, res, user) {
  const name = roleCookieName(user.role);
  const oldToken = req.cookies[name];
  if (validToken(oldToken)) {
    await Session.deleteOne({ tokenHash: digest(oldToken) });
  }
  const token = randomBytes(32).toString("hex");
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  await Session.create({
    tokenHash: digest(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + maxAge),
  });
  res.cookie(name, token, { ...cookieOptions, maxAge });
  return publicUser(user);
}

export async function authenticate(req, res, next) {
  const role = requestedRole(req);
  req.user = await sessionForRole(req, role);
  if (!req.user) fail(401, "Entre na sua conta para continuar.");
  next();
}
export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      fail(403, "Esta conta não tem acesso a esta área.");
    next();
  };
}
export const auth = Router();
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em alguns minutos." },
});
auth.post("/register", limit, async (req, res) => {
  const { role } = req.body;
  if (!["cliente", "motorista"].includes(role))
    fail(400, "Escolha Cliente ou Motorista.");
  const user = await Account.create({
    name: text(req.body.name, 3, 100, "Nome"),
    phone: phoneNumber(req.body.phone),
    passwordHash: await hashPassword(req.body.password),
    role,
    vehicle:
      role === "motorista" ? text(req.body.vehicle, 3, 100, "Veículo") : "",
    status: role === "motorista" ? "pending" : "approved",
  });
  res.status(201).json({ user: await issueSession(req, res, user) });
});
auth.post("/login", limit, async (req, res) => {
  const phone = phoneNumber(req.body.phone);
  const user = await Account.findOne({ phone }).select("+passwordHash");
  // Derive a key on missing accounts too, keeping the same expensive operation.
  const stored = user?.passwordHash || `${"0".repeat(32)}:${"0".repeat(128)}`;
  if (!(await verifyPassword(req.body.password, stored)) || !user)
    fail(401, "Telefone ou senha incorretos.");
  if (!roles.includes(req.body.role) || user.role !== req.body.role)
    fail(403, "Use a página de entrada correspondente ao seu perfil.");
  res.json({ user: await issueSession(req, res, user) });
});
auth.get("/sessions", async (req, res) => {
  const sessions = {};
  for (const role of roles) {
    const account = await sessionForRole(req, role);
    if (account) sessions[role] = publicUser(account);
  }
  res.json({ sessions });
});
auth.get("/me", authenticate, (req, res) =>
  res.json({ user: publicUser(req.user) }),
);
auth.post("/logout", async (req, res) => {
  const role = requestedRole(req);
  const name = roleCookieName(role);
  const token = req.cookies[name];
  if (validToken(token)) {
    await Session.deleteOne({ tokenHash: digest(token) });
  }
  res.clearCookie(name, cookieOptions);
  // Apague a sessão antiga somente quando ela pertencer ao perfil que saiu.
  const legacyToken = req.cookies[cookieName];
  const legacyUser = await findSessionUser(legacyToken);
  if (legacyUser?.role === role) {
    await Session.deleteOne({ tokenHash: digest(legacyToken) });
    res.clearCookie(cookieName, cookieOptions);
  }
  res.json({ ok: true });
});
export async function bootstrapAdmin() {
  if (await Account.exists({ role: "master" })) {
    console.log(
      "Conta Master encontrada. ADMIN_PHONE e ADMIN_PASSWORD não alteram uma conta já existente.",
    );
    return;
  }
  if (!process.env.ADMIN_PHONE || !process.env.ADMIN_PASSWORD) {
    console.warn(
      "Conta Master ausente: configure ADMIN_PHONE e ADMIN_PASSWORD no Render para criar o primeiro administrador.",
    );
    return;
  }
  const phone = phoneNumber(process.env.ADMIN_PHONE);
  if (await Account.exists({ phone }))
    throw new Error(
      "ADMIN_PHONE já pertence a outro cadastro. Use um número exclusivo para o Master.",
    );
  await Account.create({
    name: process.env.ADMIN_NAME || "Administrador FreteOn",
    phone,
    passwordHash: await hashPassword(process.env.ADMIN_PASSWORD),
    role: "master",
    status: "approved",
  });
  console.log(
    "Conta Master criada. As variáveis ADMIN_PHONE e ADMIN_PASSWORD podem ser removidas após o primeiro acesso.",
  );
}
