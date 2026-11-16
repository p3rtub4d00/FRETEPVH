import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { verifyPagBankWebhook, verifyLegacyPagBankWebhook } from "../src/pagBank.js";
import { getPaymentProvider } from "../src/paymentProviderSettings.js";

test("PagBank: só aceita a assinatura ECDSA/SHA256 sobre o corpo original", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const payload = Buffer.from('{"id":"CHAR_123","status":"PAID"}', "utf8");
  const signature = sign("sha256", payload, privateKey).toString("base64");
  const key = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  assert.equal(verifyPagBankWebhook(payload, signature, key), true);
  assert.equal(verifyPagBankWebhook(payload, "assinatura-invalida", key), false);
  assert.equal(verifyPagBankWebhook(Buffer.from('{"id":"CHAR_123","status":"WAITING"}'),
    signature, key), false);
  assert.equal(verifyPagBankWebhook(payload, "", key), false);
});
test("seleção bancária não ativa PagBank sem credenciais e webhook", async () => {
  const previous = process.env.PAGBANK_ENABLED;
  process.env.PAGBANK_ENABLED = "false";
  try {
    const state = await getPaymentProvider();
    assert.equal(state.available.pagbank, false);
    assert.ok(["mercadopago", "pagbank"].includes(state.preferred));
  } finally {
    if (previous === undefined) delete process.env.PAGBANK_ENABLED;
    else process.env.PAGBANK_ENABLED = previous;
  }
});

test("PagBank Order: SHA256 de token e payload original é obrigatório", () => {
  const raw = Buffer.from('{"id":"CHAR_123","status":"PAID"}');
  const token = "pagbank-token-de-teste";
  const signature = createHash("sha256").update(token).update("-").update(raw).digest("hex");
  assert.equal(verifyLegacyPagBankWebhook(raw, signature, token), true);
  assert.equal(verifyLegacyPagBankWebhook(Buffer.from('{"id":"CHAR_123","status":"WAITING"}'), signature, token), false);
  assert.equal(verifyLegacyPagBankWebhook(raw, signature, "outro-token"), false);
  assert.equal(verifyLegacyPagBankWebhook(raw, "", token), false);
});
