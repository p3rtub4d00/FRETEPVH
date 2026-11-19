import test from 'node:test';
import assert from 'node:assert/strict';
import { safeFreight } from '../src/masterCleanup.js';

const open = () => ({
  status:'open', selectedId:null, driverId:null, proposals:[],
  paymentStatus:'none', commissionStatus:'none', payoutStatus:'none',
  refundStatus:'none', disputeStatus:'none'
});
test('only untouched open freight is eligible for deletion', () => {
  assert.equal(safeFreight(open()), true);
  assert.equal(safeFreight({...open(), status:'booked'}), false);
  assert.equal(safeFreight({...open(), status:'completed'}), false);
  assert.equal(safeFreight({...open(), proposals:[{id:'offer'}]}), false);
  assert.equal(safeFreight({...open(), selectedId:'proposal-id'}), false);
});
test('financial movement and disputes protect freight history', () => {
  for (const [key,value] of [
    ['paymentStatus','paid_pagbank'],['paymentStatus','awaiting'],
    ['commissionStatus','pending'],['payoutStatus','available'],
    ['refundStatus','pending'],['disputeStatus','open']
  ]) assert.equal(safeFreight({...open(), [key]:value}), false, key);
});

test('document cleanup collects unique verified GridFS IDs only', async () => {
  const { driverDocumentIds } = await import('../src/masterCleanup.js');
  const id = '507f1f77bcf86cd799439011';
  assert.deepEqual(driverDocumentIds({ verification: { documents: [
    {fileId:id}, {fileId:id}, {fileId:'invalid'}] } }).map(String), [id]);
  assert.deepEqual(driverDocumentIds({verification:{documents:[]}}), []);
});

import express from 'express';
import { masterCleanup } from '../src/masterCleanup.js';

async function startGuardTestServer(t, role, staffAccountId) {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { role, _id: '507f1f77bcf86cd799439011', ...(staffAccountId ? { staffAccountId } : {}) };
    next();
  });
  app.use(masterCleanup);
  // Os endpoints abaixo devem continuar acessíveis para clientes/motoristas.
  for (const route of ['/state', '/push/status', '/push/config',
    '/phone-verification/status', '/phone-verification/request']) {
    app.all(route, (_req, res) => res.status(200).json({ reached: route }));
  }
  app.use((error, _req, res, _next) =>
    res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  return 'http://127.0.0.1:' + server.address().port;
}
test('proteção de exclusão não intercepta cliente nem motorista em outras APIs', async t => {
  for (const role of ['cliente', 'motorista']) {
    await t.test(role, async sub => {
      const base = await startGuardTestServer(sub, role);
      for (const [method, route] of [
        ['GET', '/state'], ['GET', '/push/status'], ['GET', '/push/config'],
        ['GET', '/phone-verification/status'], ['POST', '/phone-verification/request'],
      ]) {
        const response = await fetch(base + route, { method });
        assert.equal(response.status, 200, role + ' ' + method + ' ' + route);
        assert.deepEqual(await response.json(), { reached: route });
      }
      const forbidden = await fetch(base + '/master/cleanup');
      assert.equal(forbidden.status, 403, 'cliente/motorista não pode consultar exclusões');
    });
  }
});
test('Master da equipe também não pode executar exclusões', async t => {
  const base = await startGuardTestServer(t, 'master', '507f1f77bcf86cd799439019');
  const denied = await fetch(base + '/master/cleanup');
  assert.equal(denied.status, 403);
});
