import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { finance } from '../src/finance.js';
import { Freight } from '../src/models.js';

test('HTTP finance routes enforce refund roles, freeze payouts and save reviewed state', async t => {
  let saves = 0;
  const request = { _id: '507f1f77bcf86cd799439011', clientId: 'client', driverId: 'driver',
    status: 'completed', paymentMethod: 'pix_freteon', paymentStatus: 'simulated_paid',
    agreedPriceCents: 10000, payoutStatus: 'requested', disputeStatus: 'none', refundStatus: 'none',
    save: async () => { saves++; },
  };
  t.mock.method(Freight, 'findById', async () => request);
  const original = process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PUBLIC_KEY;
  t.after(() => { if (original !== undefined) process.env.VAPID_PUBLIC_KEY = original; });
  const app = express(); app.use(express.json());
  app.use((req,res,next) => { const role = req.get('X-Test-Role'); req.user = { role, _id: { cliente:'client', motorista:'driver', master:'master' }[role] }; next(); });
  app.use(finance);
  app.use((error,req,res,next) => res.status(error.status || 500).json({ error:error.message }));
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  t.after(() => server.close());
  async function post(role, action) {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/requests/${request._id}/finance`, {
      method:'POST', headers:{'Content-Type':'application/json','X-Test-Role':role},
      body:JSON.stringify({action,reason:'Imprevisto informado e analisado pelo Master.', amount:999999}),
    });
    await r.json(); return r.status;
  }
  assert.equal(await post('motorista','request_refund'),403);
  assert.equal(await post('cliente','request_refund'),200);
  assert.equal(request.refundAmountCents,10000);
  for (const [role,action] of [['master','confirm_payout_master'],['cliente','confirm_delivery'],['motorista','request_payout'],['cliente','report_issue']]) {
    assert.equal(await post(role,action),409);
  }
  assert.equal(saves,1);
  assert.equal(await post('cliente','approve_refund'),403);
  assert.equal(await post('master','approve_refund'),200);
  assert.equal(request.paymentStatus,'simulated_paid');
  assert.equal(await post('master','simulate_refund'),200);
  assert.equal(await post('master','simulate_refund'),409);
  assert.equal(saves,3);
});
