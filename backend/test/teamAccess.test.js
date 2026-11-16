import test from "node:test";
import assert from "node:assert/strict";
import {
  TEAM_ROLES, TEAM_PERMISSION_KEYS, validateTeamPermissions, staffAccessForRequest,
  staffHas, isPrincipal
} from "../src/teamAccess.js";
import { publicUser } from "../src/models.js";

const owner = { role: "master", _id: "owner" };
const employee = (permissions, extra = {}) => ({
  role: "master", staffAccountId: "employee", teamRole: "financeiro",
  staffPermissions: permissions, mustChangePassword: false, ...extra,
});
const request = (user, path, method = "GET", action) => ({
  user, originalUrl: `/api${path}`, method, body: { action },
});

test("apenas Master Principal é proprietário, funcionário jamais vira segundo Master", () => {
  assert.equal(isPrincipal(owner), true);
  assert.equal(isPrincipal(employee(["finance.view"])), false);
  assert.equal(staffHas(owner, "finance.payout"), true);
  assert.equal(staffHas(employee(["finance.view"]), "finance.payout"), false);
});
test("funcionário com senha provisória não acessa painel nem financeiro", () => {
  const staff = employee(["dashboard.view", "finance.view"], { mustChangePassword: true });
  assert.equal(staffAccessForRequest(request(staff, "/state")), false);
  assert.equal(staffAccessForRequest(request(staff, "/master/payment-provider")), false);
  assert.equal(staffAccessForRequest(request(staff, "/auth/staff/password", "POST")), true);
});
test("funcionário sem permissão nunca altera banco, taxa, cadastro de equipe ou recuperação", () => {
  const staff = employee(TEAM_PERMISSION_KEYS);
  for (const [path, method] of [
    ["/master/payment-provider", "PATCH"],
    ["/master/commission", "PATCH"],
    ["/master/team", "GET"],
    ["/master/team", "POST"],
    ["/master/team/0123456789abcdef01234567", "PATCH"],
    ["/recovery/master", "GET"],
    ["/recovery/master/0123456789abcdef01234567/issue", "POST"],
    ["/auth/register", "POST"]
  ]) assert.equal(staffAccessForRequest(request(staff, path, method)), false, path);
});
test("financeiro: consulta e repasse permitidos, reembolso não por padrão", () => {
  const staff = employee(TEAM_ROLES.financeiro.permissions);
  const id = "0123456789abcdef01234567";
  assert.equal(staffAccessForRequest(request(staff, "/master/payment-provider")), true);
  assert.equal(staffAccessForRequest(request(staff, "/master/payment-provider", "PATCH")), false);
  assert.equal(staffAccessForRequest(request(staff, `/requests/${id}/finance`, "POST", "confirm_payout_master")), true);
  assert.equal(staffAccessForRequest(request(staff, `/requests/${id}/finance`, "POST", "approve_refund")), false);
  assert.equal(staffAccessForRequest(request(staff, `/requests/${id}/finance`, "POST", "simulate_pix_payment")), false);
  assert.equal(staffAccessForRequest(request(staff, `/drivers/${id}`, "PATCH")), false);
});
test("operacional revisa motoristas mas não atua em pagamentos", () => {
  const staff = employee(TEAM_ROLES.operacional.permissions);
  const id = "0123456789abcdef01234567";
  assert.equal(staffAccessForRequest(request(staff, `/driver-verification/${id}`)), true);
  assert.equal(staffAccessForRequest(request(staff, `/driver-verification/${id}/review`, "PATCH")), true);
  assert.equal(staffAccessForRequest(request(staff, `/requests/${id}/finance`, "POST", "confirm_delivery_master")), true);
  assert.equal(staffAccessForRequest(request(staff, `/requests/${id}/finance`, "POST", "confirm_payout_master")), false);
});
test("auditor não escreve, rotas desconhecidas são bloqueadas", () => {
  const staff = employee(TEAM_ROLES.auditor.permissions, { teamRole: "auditor" });
  assert.equal(staffAccessForRequest(request(staff, "/master/audit")), true);
  assert.equal(staffAccessForRequest(request(staff, "/master/reports")), true);
  assert.equal(staffAccessForRequest(request(staff, "/master/reports/0123456789abcdef01234567", "PATCH")), false);
  assert.equal(staffAccessForRequest(request(staff, "/alguma-nova-rota-master", "GET")), false);
});
test("validação de permissões impede privilégios fora de catálogo e combinações inconsistentes", () => {
  assert.deepEqual(validateTeamPermissions("financeiro", TEAM_ROLES.financeiro.permissions),
    TEAM_ROLES.financeiro.permissions);
  assert.throws(() => validateTeamPermissions("financeiro", ["dashboard.view", "finance.payout"]), /exige/);
  assert.throws(() => validateTeamPermissions("financeiro", ["dashboard.view", "bank.manage"]), /inválidas/);
  assert.throws(() => validateTeamPermissions("auditor", ["dashboard.view", "finance.refund"]), /somente de leitura/);
  assert.throws(() => validateTeamPermissions("unknown", ["dashboard.view"]), /inválido/);
});
test("serialização não expõe papel staff como Master Principal", () => {
  const user = publicUser({ _id: "employee", name: "Equipe Teste", phone: "69999999999",
    role: "staff", status: "approved", teamRole: "atendimento",
    staffPermissions: TEAM_ROLES.atendimento.permissions, mustChangePassword: true });
  assert.equal(user.role, "master");
  assert.equal(user.adminRole, "atendimento");
  assert.equal(user.mustChangePassword, true);
});
