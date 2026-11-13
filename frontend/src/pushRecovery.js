// Restore a previously authorized browser subscription after logout or a
// server-side expiry. Never prompt for permission or create a new subscription.
export async function recoverPush({ subscription, publicKey, permission, endpointHashes, save, digest }) {
  if (!subscription || permission !== "granted") return false;
  const rawKey = subscription.options?.applicationServerKey;
  if (rawKey) {
    const current = Array.from(new Uint8Array(rawKey));
    const expected = Array.from(Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)));
    if (current.length !== expected.length || current.some((v, i) => v !== expected[i])) return false;
  }
  const hash = await digest(subscription.endpoint);
  if (!endpointHashes.includes(hash)) await save(subscription.toJSON());
  return true;
}
