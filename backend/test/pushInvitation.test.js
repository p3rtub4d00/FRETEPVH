import test from "node:test";
import assert from "node:assert/strict";
import { PUSH_REMINDER_MS, shouldOfferPush } from "../../frontend/src/pushInvitationRules.js";

const now = Date.now();
const base = {
  role: "motorista", canDisplay: true, loaded: true, serverEnabled: true,
  supported: true, permission: "default", active: false, dismissedAt: 0, now,
};
test("oferece convite push para Cliente, Motorista e Master no mesmo PWA", () => {
  assert.equal(shouldOfferPush(base), true);
  assert.equal(shouldOfferPush({ ...base, role: "cliente" }), true);
  assert.equal(shouldOfferPush({ ...base, role: "master" }), true);
  assert.equal(shouldOfferPush({ ...base, role: "master", permission: "granted" }), true);
});
test("não mostra quando falta suporte, permissão, configuração ou quando já está ativo", () => {
  for (const options of [
    { supported: false }, { permission: "denied" },
    { active: true }, { serverEnabled: false }, { loaded: false },
    { canDisplay: false }, { role: "visitante" },
  ]) assert.equal(shouldOfferPush({ ...base, ...options }), false);
  assert.equal(shouldOfferPush({ ...base, role: "master", active: true }), false);
});
test("respeita dispensa por sete dias, evitando repetição em cada acesso", () => {
  assert.equal(shouldOfferPush({ ...base, dismissedAt: now - 1000 }), false);
  assert.equal(shouldOfferPush({ ...base, dismissedAt: now - PUSH_REMINDER_MS + 1000 }), false);
  assert.equal(shouldOfferPush({ ...base, dismissedAt: now - PUSH_REMINDER_MS - 1000 }), true);
});
