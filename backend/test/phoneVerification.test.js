import test from 'node:test';
import assert from 'node:assert/strict';
import { requireVerifiedPhone } from '../src/phoneVerification.js';

const phone = '69999999999';
test('confirmed phone permits client and driver operations', () => {
  for (const role of ['cliente','motorista']) {
    let accepted = false;
    requireVerifiedPhone({user:{role,phone,phoneVerifiedNumber:phone,
      phoneVerifiedAt:new Date()}}, null, () => { accepted=true; });
    assert.equal(accepted,true);
  }
});
test('unverified, changed or mismatched numbers do not pass', () => {
  for (const user of [
    {role:'cliente',phone},
    {role:'motorista',phone,phoneVerifiedNumber:phone},
    {role:'cliente',phone,phoneVerifiedAt:new Date(),phoneVerifiedNumber:'69988888888'}
  ]) assert.throws(() => requireVerifiedPhone({user},null,()=>{}), /Verifique seu celular/);
});
