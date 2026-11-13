import test from "node:test";
import assert from "node:assert/strict";
import {
  createECDH, createHmac, createDecipheriv, randomBytes,
} from "node:crypto";
import { checkSubscription, encryptPush, sendPush } from "../src/webPush.js";

const encoded = (b) => Buffer.from(b).toString("base64url");
const hmac = (k, data) => createHmac("sha256", k).update(data).digest();
const inf = (name) => Buffer.concat([Buffer.from(name), Buffer.from([0, 1])]);

function newSubscription() {
  const device = createECDH("prime256v1");
  device.generateKeys();
  const secret = randomBytes(16);
  return {
    device, secret,
    subscription: {
      endpoint: "https://fcm.googleapis.com/fcm/send/example-subscription-endpoint-long",
      keys: { p256dh: encoded(device.getPublicKey()), auth: encoded(secret) },
    },
  };
}

test("subscription rejects untrusted targets, missing keys and invalid points", () => {
  const { subscription } = newSubscription();
  assert.equal(checkSubscription(subscription).endpoint, subscription.endpoint);
  assert.throws(() => checkSubscription({
    ...subscription, endpoint: "https://localhost/internal",
  }), /inscrição push inválida/i);
  assert.throws(() => checkSubscription({
    ...subscription, endpoint: "http://fcm.googleapis.com/fcm/send/unsafe",
  }), /inscrição push inválida/i);
  assert.throws(() => checkSubscription({
    ...subscription, keys: { ...subscription.keys, auth: "xyz" },
  }), /chaves de notificação/i);
});

test("encrypted Web Push message decrypts using receiver keys", () => {
  const { device, secret, subscription } = newSubscription();
  const data = { title: "Teste", body: "Frete reservado", role: "motorista" };
  const raw = encryptPush(data, subscription.keys.p256dh, subscription.keys.auth);
  assert.equal(raw.length > 86, true);
  const salt = raw.subarray(0, 16);
  const recordSize = raw.readUInt32BE(16);
  const keySize = raw[20];
  const sender = raw.subarray(21, 21 + keySize);
  assert.equal(recordSize, 4096);
  assert.equal(keySize, 65);
  const shared = device.computeSecret(sender);
  const info = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    device.getPublicKey(),
    sender,
    Buffer.from([1]),
  ]);
  const prkKey = hmac(secret, shared);
  const ikm = hmac(prkKey, info);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, inf("Content-Encoding: aes128gcm")).subarray(0, 16);
  const nonce = hmac(prk, inf("Content-Encoding: nonce")).subarray(0, 12);
  const encrypted = raw.subarray(21 + keySize);
  const ciphertext = encrypted.subarray(0, -16);
  const tag = encrypted.subarray(-16);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(tag);
  const decoded = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  assert.equal(decoded.at(-1), 2);
  assert.deepEqual(JSON.parse(decoded.subarray(0, -1).toString()), data);
});

test("VAPID sender uses authenticated encrypted POST", async () => {
  const old = {
    pub: process.env.VAPID_PUBLIC_KEY,
    priv: process.env.VAPID_PRIVATE_KEY,
    subj: process.env.VAPID_SUBJECT,
    fetch: globalThis.fetch,
  };
  const server = createECDH("prime256v1");
  server.generateKeys();
  process.env.VAPID_PUBLIC_KEY = encoded(server.getPublicKey());
  process.env.VAPID_PRIVATE_KEY = encoded(server.getPrivateKey());
  process.env.VAPID_SUBJECT = "https://fretepvh.onrender.com";
  const { subscription } = newSubscription();
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, subscription.endpoint);
      assert.equal(options.method, "POST");
      assert.equal(options.headers["Content-Encoding"], "aes128gcm");
      assert.match(options.headers.Authorization, /^vapid t=.+, k=.+$/);
      assert.equal(options.body[20], 65);
      return { ok: true, status: 201 };
    };
    assert.deepEqual(
      await sendPush({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      }, { title: "Teste" }),
      { ok: true, gone: false, status: 201 },
    );
  } finally {
    globalThis.fetch = old.fetch;
    if (old.pub === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = old.pub;
    if (old.priv === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = old.priv;
    if (old.subj === undefined) delete process.env.VAPID_SUBJECT;
    else process.env.VAPID_SUBJECT = old.subj;
  }
});
