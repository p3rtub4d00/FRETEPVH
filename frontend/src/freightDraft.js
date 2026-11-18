// Rascunhos locais em IndexedDB: suporta fotos em data URLs sem limite pequeno do localStorage.
// São separados por usuário e nunca enviados a terceiros antes da publicação.
const DB_NAME = 'freteon-drafts';
const STORE = 'freight-requests';
function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponível'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction(key, method, value) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const request = method === 'put'
        ? tx.objectStore(STORE).put(value, key)
        : method === 'delete'
          ? tx.objectStore(STORE).delete(key)
          : tx.objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export const draftKey = userId => 'freight:' + String(userId);
export const readFreightDraft = userId => transaction(draftKey(userId), 'get');
export const saveFreightDraft = (userId, data, step) =>
  transaction(draftKey(userId), 'put', { data, step, savedAt: Date.now() });
export const deleteFreightDraft = userId => transaction(draftKey(userId), 'delete');
