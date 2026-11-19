import test from 'node:test';
import assert from 'node:assert/strict';
import { hasFreightDraftContent, draftKey } from '../../frontend/src/freightDraft.js';

test('opening an untouched form does not create a draft', () => {
  assert.equal(hasFreightDraftContent({ title:'', origin:'', destination:'', description:'',
    date:'', time:'', helper:false, paymentMethod:'', photos:[] }), false);
  assert.equal(hasFreightDraftContent({ originAddress:{ street:'', number:'', neighborhood:'',
    city:'Porto Velho', state:'RO' } }), false);
  assert.equal(hasFreightDraftContent(null), false);
});
test('addresses, photos, scheduling and typed fields count as a real draft', () => {
  assert.equal(hasFreightDraftContent({ originAddress:{ street:'Rua A' }}), true);
  assert.equal(hasFreightDraftContent({ title:' Sofá ' }), true);
  assert.equal(hasFreightDraftContent({ photos:['data:image/jpeg;base64,AA=='] }), true);
  assert.equal(hasFreightDraftContent({ date:'2099-12-01' }), true);
  assert.equal(hasFreightDraftContent({ paymentMethod:'pix_freteon' }), true);
  assert.equal(hasFreightDraftContent({ helper:true }), true);
});
test('separate users have separate draft keys', () => {
  assert.notEqual(draftKey('cliente-A'), draftKey('cliente-B'));
});
