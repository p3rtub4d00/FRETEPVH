import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  createHash,
  randomBytes,
  sign,
} from "node:crypto";
import { PushSubscription } from "./models.js";

const enc = (buffer) => Buffer.from(buffer).toString("base64url");
const dec = (value) => Buffer.from(value, "base64url");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (key, input) => createHmac("sha256", key).update(input).digest();
const info = (label) => Buffer.concat([Buffer.from(label, "ascii"), Buffer.from([0, 1])]);

function validEndpoint(raw) {
  if (typeof raw !== "string" || raw.length < 30 || raw.length > 2200) return null;
  try {
    const endpoint = new URL(raw);
    const host = endpoint.hostname.toLowerCase();
    const allowed =
      host === "fcm.googleapis.com" ||
      host.endsWith(".push.services.mozilla.com") ||
      host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com") ||
      host === "notify.windows.com";
    if (endpoint.protocol !== "https:" || endpoint.port || !allowed ||
        endpoint.username || endpoint.password || endpoint.hash)
      return null;
    return endpoint.toString();
  } catch {
    return null;
  }
}

export function checkSubscription(input) {
  const endpoint = validEndpoint(input?.endpoint);
  const keys = input?.keys;
  if (!endpoint || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string")
    throw Object.assign(new Error("Inscrição push inválida ou serviço não permitido."), { status: 400 });
  const publicKey = dec(keys.p256dh);
  const authSecret = dec(keys.auth);
  if (publicKey.length !== 65 || publicKey[0] !== 4 || authSecret.length !== 16)
    throw Object.assign(new Error("Chaves de notificação inválidas."), { status: 400 });
  return { endpoint, endpointHash: hash(endpoint), p256dh: keys.p256dh, auth: keys.auth };
}

export function pushEnabled() {
  return Boolean(
    /^[A-Za-z0-9_-]{86,88}$/.test(process.env.VAPID_PUBLIC_KEY || "") &&
    /^[A-Za-z0-9_-]{42,44}$/.test(process.env.VAPID_PRIVATE_KEY || ""),
  );
}

function createVapidJwt(endpoint) {
  const publicKey = dec(process.env.VAPID_PUBLIC_KEY);
  const privateKey = dec(process.env.VAPID_PRIVATE_KEY);
  const privateJwk = {
    kty: "EC", crv: "P-256",
    d: enc(privateKey),
    x: enc(publicKey.subarray(1, 33)),
    y: enc(publicKey.subarray(33, 65)),
  };
  const key = createPrivateKey({ key: privateJwk, format: "jwk" });
  const jwtHead = enc(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const jwtPayload = enc(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: process.env.VAPID_SUBJECT || "https://fretepvh.onrender.com",
  }));
  const signed = jwtHead + "." + jwtPayload;
  const signature = sign("sha256", Buffer.from(signed), { key, dsaEncoding: "ieee-p1363" });
  return signed + "." + enc(signature);
}

/** Encryption per RFC8291/RFC8188: one aes128gcm record. */
export function encryptPush(payload, p256dh, auth) {
  const receiver = dec(p256dh);
  const authSecret = dec(auth);
  if (receiver.length !== 65 || receiver[0] !== 4 || authSecret.length !== 16)
    throw new Error("Chaves de inscrição inválidas.");
  const sender = createECDH("prime256v1");
  sender.generateKeys();
  const senderPub = sender.getPublicKey();
  const shared = sender.computeSecret(receiver);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), receiver, senderPub]);
  const prkKey = hmac(authSecret, shared);
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])]));
  const salt = randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, info("Content-Encoding: aes128gcm")).subarray(0, 16);
  const nonce = hmac(prk, info("Content-Encoding: nonce")).subarray(0, 12);
  const raw = Buffer.concat([Buffer.from(JSON.stringify(payload)), Buffer.from([2])]);
  if (raw.length > 3200) throw new Error("Notificação muito grande.");
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(raw), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  return Buffer.concat([salt, recordSize, Buffer.from([senderPub.length]), senderPub, ciphertext]);
}

export async function sendPush(subscription, message) {
  if (!pushEnabled()) return { ok: false, unavailable: true };
  const checked = checkSubscription({
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  });
  const endpoint = checked.endpoint;
  const body = encryptPush(message, checked.p256dh, checked.auth);
  const jwt = createVapidJwt(endpoint);
  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(6500),
    headers: {
      Authorization: `vapid t=${jwt}, k=${process.env.VAPID_PUBLIC_KEY}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "3600",
      Urgency: "normal",
    },
    body,
    redirect: "error",
  });
  return {
    ok: response.ok,
    gone: response.status === 404 || response.status === 410,
    status: response.status,
  };
}

function safeMessage(msg) {
  const role = msg.role === "cliente" ? "cliente" : "motorista";
  const title = String(msg.title || "FreteOn").slice(0, 90);
  const body = String(msg.body || "Você tem uma atualização de frete.").slice(0, 180);
  const id = String(msg.id || "").slice(0, 80);
  return { title, body, path: role === "cliente" ? "/cliente" : "/motorista", id, role };
}

/** Never include street addresses, personal phones or financial keys in push. */
export async function notifyAccounts(userIds, message) {
  if (!pushEnabled()) return { attempted: 0, ok: 0 };
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return { attempted: 0, ok: 0 };
  const subscriptions = await PushSubscription.find({ userId: { $in: ids } }).limit(300).lean();
  const safe = safeMessage(message);
  let delivered = 0;
  await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      const result = await sendPush(subscription, safe);
      if (result.ok) delivered += 1;
      if (result.gone)
        await PushSubscription.deleteOne({ _id: subscription._id });
    } catch (error) {
      // No endpoint URL or encrypted keys in logs.
      console.warn("Envio push não concluído:", error?.name || "Erro");
    }
  }));
  return { attempted: subscriptions.length, ok: delivered };
}

export function notifyInBackground(userIds, message) {
  void notifyAccounts(userIds, message).catch((error) => {
    console.warn("Notificações indisponíveis:", error?.name || "Erro");
  });
}
