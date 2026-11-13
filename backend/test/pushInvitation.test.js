import test from "node:test";
import assert from "node:assert/strict";
import { PUSH_REMINDER_MS, shouldOfferPush } from "../../frontend/src/pushInvitationRules.js";

const now = Date.now();
const base = {
  role: "motorista", canDisplay: true, loaded: true, serverEnabled: true,
  supported: true, permission: "default", active: false, dismissedAt: 0, now,
};
test("mostra o convite automaticamente para Cliente e Motorista sem permissão ativa", () => {
  assert.equal(shouldOfferPush(base), true);
  assert.equal(shouldOfferPush({ ...base, role: "cliente" }), true);
  assert.equal(shouldOfferPush({ ...base, permission: "granted" }), true);
});
test("não mostra para Master, aparelho sem suporte, permissão negada ou push já ativo", () => {
  for (const options of [
    { role: "master" }, { supported: false }, { permission: "denied" },
    { active: true }, { serverEnabled: false }, { loaded: false },
    { canDisplay: false },
  ]) assert.equal(shouldOfferPush({ ...base, ...options }), false);
});
test("respeita dispensa por sete dias, evitando repetição em cada acesso", () => {
  assert.equal(shouldOfferPush({ ...base, dismissedAt: now - 1000 }), false);
  assert.equal(shouldOfferPush({ ...base, dismissedAt: now - PUSH_REMINDER_MS + 1000 }), false);
  assert.equal(shouldOfferPush({ ...base, dismissedAt: now - PUSH_REMINDER_MS - 1000 }), true);
});
