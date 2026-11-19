// Rascunhos locais em IndexedDB, separados por conta do cliente.
const DB_NAME = 'freteon-drafts';
const STORE = 'freight-requests';
const operations = new Map();

export function hasFreightDraftContent(data) {
  if (!data || typeof data !== 'object') return false;
  const filled = key => typeof data[key] === 'string' && data[key].trim().length > 0;
  const addressFilled = key => {
    const value = data[key];
    return value && typeof value === 'object' &&
      ['street', 'number', 'neighborhood', 'complement', 'reference']
        .some(field => typeof value[field] === 'string' && value[field].trim().length > 0);
  };
  return ['title', 'origin', 'destination', 'description', 'date', 'time', 'paymentMethod'].some(filled)
    || data.helper === true || (Array.isArray(data.photos) && data.photos.length > 0)
    || Boolean(addressFilled('originAddress') || addressFilled('destinationAddress'));
}
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
      const tx = db.transaction(STORE, method === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore(STORE);
      let result;
      const request = method === 'put' ? store.put(value, key)
        : method === 'delete' ? store.delete(key) : store.get(key);
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || request.error);
      tx.onabort = () => reject(tx.error || new Error('Armazenamento interrompido'));
    });
  } finally { db.close(); }
}
function enqueue(key, operation) {
  const previous = operations.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  operations.set(key, next);
  next.finally(() => { if (operations.get(key) === next) operations.delete(key); }).catch(() => {});
  return next;
}
export const draftKey = userId => 'freight:' + String(userId);
export const readFreightDraft = userId => {
  const key = draftKey(userId);
  return enqueue(key, () => transaction(key, 'get'));
};
export const saveFreightDraft = (userId, data, step) => {
  const key = draftKey(userId);
  return enqueue(key, () => transaction(key, 'put', { data, step, savedAt: Date.now() }));
};
export const deleteFreightDraft = userId => {
  const key = draftKey(userId);
  return enqueue(key, () => transaction(key, 'delete'));
};
