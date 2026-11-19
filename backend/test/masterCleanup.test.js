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
