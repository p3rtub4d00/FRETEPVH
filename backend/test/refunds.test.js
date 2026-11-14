import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRefund, refundBlocks, canRequestRefund } from '../src/refunds.js';
import { confirmDelivery, walletSummary } from '../src/finance.js';
const client = { _id: 'client', role: 'cliente' }, master = { _id: 'master', role: 'master' };
const fixture = (extra = {}) => ({ clientId: 'client', driverId: 'driver', status: 'booked', paymentMethod: 'pix_freteon', paymentStatus: 'simulated_paid', agreedPriceCents: 25000, driverNetCents: 22500, payoutStatus: 'none', disputeStatus: 'none', refundStatus: 'none', ...extra });
const reason = 'Tive um imprevisto e não preciso do transporte.';
test('request, approve and simulate refund are separate audited transitions', () => {
  const r = fixture();
  applyRefund(r, client, 'request_refund', reason);
  assert.equal(r.refundStatus, 'pending');
  assert.equal(r.status, 'booked');
  assert.equal(r.refundAmountCents, 25000);
  assert.equal(r.refundStage, 'booked');
  assert.ok(r.refundRequestedAt instanceof Date);
  assert.equal(refundBlocks(r), true);
  assert.throws(() => applyRefund(r, master, 'simulate_refund'), /Aprove/);
  applyRefund(r, master, 'approve_refund', 'Cancelamento autorizado antes da coleta.');
  assert.equal(r.status, 'cancelled');
  assert.equal(r.paymentStatus, 'simulated_paid');
  assert.equal(r.refundReviewedBy, 'master');
  assert.equal(r.payoutStatus, 'none');
  applyRefund(r, master, 'simulate_refund');
  assert.equal(r.paymentStatus, 'refunded_simulated');
  assert.ok(r.refundedAt instanceof Date);
  assert.equal(r.refundedBy, 'master');
  assert.throws(() => applyRefund(r, master, 'simulate_refund'), /indisponível/);
});
test('rejection requires justification and restores previous stage and payout eligibility', () => {
  const r = fixture({ status: 'completed', payoutStatus: 'requested' });
  applyRefund(r, client, 'request_refund', reason);
  assert.throws(() => applyRefund(r, master, 'reject_refund', ''), /motivo/);
  applyRefund(r, master, 'reject_refund', 'Serviço entregue e confirmado na análise.');
  assert.equal(r.status, 'completed');
  assert.equal(r.payoutStatus, 'requested');
  assert.equal(refundBlocks(r), false);
  assert.equal(canRequestRefund(r), false);
});
test('unpaid, non-Pix, settled, disputed, repeated and unauthorized refunds are rejected', () => {
  for (const extra of [{ paymentStatus: 'awaiting' }, { paymentMethod: 'cash_driver' }, { payoutStatus: 'paid_simulated' }, { disputeStatus: 'open' }, { refundStatus: 'pending' }, { agreedPriceCents: 0 }]) {
    assert.throws(() => applyRefund(fixture(extra), client, 'request_refund', reason), /não permite/);
  }
  for (const user of [{ _id: 'other', role: 'cliente' }, { _id: 'driver', role: 'motorista' }]) {
    assert.throws(() => applyRefund(fixture(), user, 'request_refund', reason), /Somente o cliente/);
    assert.throws(() => applyRefund(fixture({ refundStatus: 'pending' }), user, 'approve_refund', reason), /Somente o Master/);
  }
});
test('refund under review blocks delivery and excludes available or requested payout totals', () => {
  for (const payoutStatus of ['available', 'requested']) {
    const r = fixture({ status: 'completed', payoutStatus });
    applyRefund(r, client, 'request_refund', reason);
    assert.throws(() => confirmDelivery(r), /reembolso/);
    const wallet = walletSummary([r], { _id: 'driver', role: 'motorista' });
    assert.equal(wallet.availableCents, 0);
    assert.equal(wallet.requestedCents, 0);
  }
});
test('transport already underway requires the same manual review without automatic refund', () => {
  const r = fixture({ status: 'transit' });
  applyRefund(r, client, 'request_refund', reason);
  assert.equal(r.refundStage, 'transit');
  assert.equal(r.status, 'transit');
  assert.equal(r.paymentStatus, 'simulated_paid');
});
