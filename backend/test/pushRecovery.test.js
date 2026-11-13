import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverPush } from '../../frontend/src/pushRecovery.js';

const subscription = { endpoint: 'device', options: { applicationServerKey: Uint8Array.of(1,2,3).buffer }, toJSON: () => ({ endpoint: 'device' }) };
const setup = (overrides = {}) => ({ subscription, publicKey: 'AQID', permission: 'granted', endpointHashes: [], digest: async () => 'hash', save: async () => {}, ...overrides });
test('restores an authorized device missing after logout/login', async () => {
  let calls = 0;
  assert.equal(await recoverPush(setup({ save: async data => { assert.equal(data.endpoint, 'device'); calls++; } })), true);
  assert.equal(calls, 1);
});
test('does not register again when server already knows the device', async () => {
  assert.equal(await recoverPush(setup({ endpointHashes: ['hash'], save: () => assert.fail() })), true);
});
test('does not silently enable disabled, denied, or mismatched-key subscriptions', async () => {
  for (const overrides of [{ subscription: null }, { permission: 'denied' }, { permission: 'default' }, { publicKey: 'BAUG' }]) {
    assert.equal(await recoverPush(setup({ ...overrides, save: () => assert.fail() })), false);
  }
});
test('does not claim active when server rejects recovery', async () => {
  await assert.rejects(recoverPush(setup({ save: async () => { throw new Error('offline'); } })), /offline/);
});
