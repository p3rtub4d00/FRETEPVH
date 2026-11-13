import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { freightCommunication } from '../src/freightCommunication.js';
import { Freight, FreightChat, PushSubscription } from '../src/models.js';

test('chat sends push only to the other participant in both directions', async t => {
  const request = { _id: '507f1f77bcf86cd799439011', clientId: 'client', driverId: 'driver', status: 'booked' };
  const recipients = [];
  t.mock.method(Freight, 'findById', async () => request);
  t.mock.method(FreightChat, 'create', async data => ({ ...data, _id: '507f1f77bcf86cd799439012' }));
  t.mock.method(PushSubscription, 'find', query => {
    recipients.push(query.userId.$in);
    return { limit: () => ({ lean: async () => [] }) };
  });
  const oldPublic = process.env.VAPID_PUBLIC_KEY, oldPrivate = process.env.VAPID_PRIVATE_KEY;
  process.env.VAPID_PUBLIC_KEY = 'A'.repeat(87);
  process.env.VAPID_PRIVATE_KEY = 'A'.repeat(43);
  t.after(() => {
    if (oldPublic === undefined) delete process.env.VAPID_PUBLIC_KEY; else process.env.VAPID_PUBLIC_KEY = oldPublic;
    if (oldPrivate === undefined) delete process.env.VAPID_PRIVATE_KEY; else process.env.VAPID_PRIVATE_KEY = oldPrivate;
  });
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { const role = req.get('X-Test-Role'); req.user = { role, _id: role === 'cliente' ? 'client' : 'driver' }; next(); });
  app.use(freightCommunication);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  for (const role of ['cliente', 'motorista']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/requests/${request._id}/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-Role': role }, body: JSON.stringify({ content: 'Estou aguardando na entrada.' }),
    });
    assert.equal(response.status, 201);
    await response.json();
  }
  assert.deepEqual(recipients, [['driver'], ['client']]);
});
