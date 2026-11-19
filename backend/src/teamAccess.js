import mongoose from "mongoose";

// Permissões explícitas. A alteração de banco, das taxas e da equipe permanece
// exclusiva do Master Principal, independentemente do cargo personalizado.
export const TEAM_PERMISSIONS = Object.freeze({
  "dashboard.view": "Visão geral do painel",
  "drivers.view": "Consultar motoristas e documentos",
  "drivers.manage": "Aprovar e revisar motoristas",
  "freights.view": "Consultar fretes e rotas",
  "freights.manage": "Confirmar entrega e tratar fretes",
  "finance.view": "Consultar financeiro e cobranças",
  "finance.payout": "Registrar repasses autorizados",
  "finance.refund": "Aprovar ou recusar reembolsos",
  "finance.dispute": "Resolver contestações financeiras",
  "support.view": "Consultar denúncias e conversas",
  "support.manage": "Resolver denúncias",
  "notifications.view": "Consultar notificações administrativas",
  "users.view": "Consultar usuários cadastrados",
  "audit.view": "Consultar histórico de atividades"
});
export const TEAM_ROLES = Object.freeze({
  operacional: { label: "Administrador operacional", permissions: [
    "dashboard.view", "drivers.view", "drivers.manage", "freights.view",
    "freights.manage", "support.view", "support.manage",
    "notifications.view", "users.view"
  ] },
  financeiro: { label: "Financeiro", permissions: [
    "dashboard.view", "finance.view", "finance.payout",
    "freights.view", "notifications.view"
  ] },
  atendimento: { label: "Atendimento", permissions: [
    "dashboard.view", "drivers.view", "freights.view",
    "support.view", "notifications.view", "users.view"
  ] },
  auditor: { label: "Auditor (somente leitura)", permissions: [
    "dashboard.view", "drivers.view", "freights.view", "finance.view",
    "support.view", "notifications.view", "users.view", "audit.view"
  ] }
});
export const TEAM_PERMISSION_KEYS = Object.freeze(Object.keys(TEAM_PERMISSIONS));
export function validateTeamPermissions(role, input) {
  if (!Object.hasOwn(TEAM_ROLES, role)) throw Object.assign(
    new Error("Nível administrativo inválido."), { status: 400 });
  if (!Array.isArray(input) || input.length > TEAM_PERMISSION_KEYS.length ||
      input.some(x => typeof x !== "string" || !Object.hasOwn(TEAM_PERMISSIONS, x)))
    throw Object.assign(new Error("Permissões inválidas."), { status: 400 });
  const permissions = [...new Set(input)];
  if (!permissions.includes("dashboard.view"))
    throw Object.assign(new Error("Mantenha o acesso à visão geral."), { status: 400 });
  if (role === "auditor" && permissions.some(key => !key.endsWith(".view")))
    throw Object.assign(new Error("O nível Auditor é exclusivamente de leitura."), { status: 400 });
  const dependencies = {
    "drivers.manage": "drivers.view",
    "freights.manage": "freights.view",
    "finance.payout": "finance.view",
    "finance.refund": "finance.view",
    "finance.dispute": "finance.view",
    "support.manage": "support.view",
  };
  for (const [key, dependency] of Object.entries(dependencies)) {
    if (permissions.includes(key) && !permissions.includes(dependency))
      throw Object.assign(new Error(`A permissão ${key} exige ${dependency}.`), { status: 400 });
  }
  return permissions;
}
export const isPrincipal = user => user?.role === "master" && !user.staffAccountId;
export const staffHas = (user, permission) =>
  isPrincipal(user) || (user?.role === "master" &&
    Boolean(user.staffAccountId) && user.staffPermissions?.includes(permission));

const auditSchema = new mongoose.Schema({
  actorId: { type: String, required: true },
  actorRole: { type: String, required: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  targetId: { type: String, default: "" },
  status: { type: Number, required: true }
}, { timestamps: true });
auditSchema.index({ createdAt: -1 });
auditSchema.index({ actorId: 1, createdAt: -1 });
export const TeamAuditEvent = mongoose.models.FreteOnTeamAuditEvent ||
  mongoose.model("FreteOnTeamAuditEvent", auditSchema);

export function trackAdministrativeAction(req, res) {
  if (req.user?.role !== "master" ||
      ["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const url = req.originalUrl.split("?")[0].replace(/^\/api/, "");
  const actorId = String(req.user._id);
  const actorRole = req.user.staffAccountId ? req.user.teamRole : "owner";
  res.once("finish", () => {
    if (res.statusCode >= 400) return;
    const targetId = url.match(/[a-f\d]{24}/i)?.[0] || "";
    void TeamAuditEvent.create({
      actorId, actorRole, method: req.method, path: url.slice(0, 180),
      targetId, status: res.statusCode
    }).catch(() => console.warn("Falha ao registrar trilha de auditoria administrativa."));
  });
}
function allowed(req, permission) { return staffHas(req.user, permission); }
export function staffAccessForRequest(req) {
  if (!req.user?.staffAccountId) return true;
  const method = req.method;
  const pathname = req.originalUrl.split("?")[0].replace(/^\/api/, "");
  if (pathname === "/auth/me" || pathname === "/auth/staff/password") return true;
  if (req.user.mustChangePassword) return false;
  if (method === "GET" && pathname === "/state")
    return req.user.staffPermissions.includes("dashboard.view");
  if (pathname === "/master/notifications" && method === "GET" ||
      /^\/master\/notifications\/(?:read-all|[^/]+\/read)$/.test(pathname))
    return allowed(req, "notifications.view");
  if (pathname === "/master/payment-provider")
    return method === "GET" && allowed(req, "finance.view");
  if (pathname === "/master/commission")
    return method === "GET" && allowed(req, "finance.view");
  if (/^\/master\/freights\/[a-f\d]{24}\/chat$/i.test(pathname))
    return method === "GET" && allowed(req, "freights.view") && allowed(req, "support.view");
  if (pathname.startsWith("/master/team")) return false;
  if (pathname.startsWith("/master/audit")) return method === "GET" && allowed(req, "audit.view");
  if (/^\/master\/reports(?:\/|$)/.test(pathname))
    return method === "GET" ? allowed(req, "support.view") :
      method === "PATCH" ? allowed(req, "support.manage") : false;
  if (pathname.startsWith("/master/")) return false;
  if (pathname.startsWith("/recovery/master")) return false;
  if (pathname.startsWith("/privacy/") || pathname.startsWith("/legal/")) return false;
  if (/^\/drivers\/[a-f\d]{24}$/i.test(pathname))
    return method === "PATCH" && allowed(req, "drivers.manage");
  if (/^\/driver-verification\/[a-f\d]{24}(?:\/documents\/[^/]+|\/review)?$/i.test(pathname)) {
    if (method === "GET") return allowed(req, "drivers.view");
    return method === "PATCH" && pathname.endsWith("/review") && allowed(req, "drivers.manage");
  }
  if (/^\/requests\/[a-f\d]{24}\/finance$/i.test(pathname) && method === "POST") {
    const action = req.body?.action;
    if (["approve_refund", "reject_refund"].includes(action))
      return allowed(req, "finance.refund");
    if (["confirm_payout_master", "confirm_test_payout_master"].includes(action))
      return allowed(req, "finance.payout");
    if (["resolve_dispute_accept_master", "resolve_dispute_cancel_master"].includes(action))
      return allowed(req, "finance.dispute");
    if (action === "confirm_delivery_master") return allowed(req, "freights.manage");
    return false;
  }
  if (/^\/requests\/[a-f\d]{24}\/calculate-route$/i.test(pathname) && method === "POST")
    return allowed(req, "freights.view");
  if (pathname.startsWith("/push/")) return allowed(req, "notifications.view");
  // Em dúvida, negar: contas de equipe nunca ganham acesso por herança
  // de uma rota Master recém-criada.
  return false;
}
