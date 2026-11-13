import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../frontend/public/sw.js', import.meta.url), 'utf8');
test('chat push displays with panel closed even if window enumeration fails', async () => {
  const listeners = {}; const shown = [];
  vm.runInNewContext(source, { self: {
    addEventListener: (name, fn) => { listeners[name] = fn; },
    clients: { matchAll: async () => { throw new Error('no windows'); } },
    registration: { showNotification: async (...args) => shown.push(args) },
  }, URL, Response });
  for (const role of ['cliente', 'motorista']) {
    let task;
    listeners.push({ data: { json: () => ({ title: 'Nova mensagem sobre o frete', role, id: 'chat-123' }) }, waitUntil: p => { task = p; } });
    await task;
    assert.equal(shown.at(-1)[1].data.path, '/' + role);
    assert.equal(shown.at(-1)[1].tag, `freteon-${role}-chat-123`);
  }
});
