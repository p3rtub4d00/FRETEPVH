import test from 'node:test';
import assert from 'node:assert/strict';
import { postPush } from '../src/pushTransport.js';
test('transient gateway and network failures recover with one bounded retry', async () => {
  for (const first of [429,503,'network']) {
    let calls=0;const delays=[];
    const response=await postPush('https://example.invalid',{}, {wait:async ms=>delays.push(ms),request:async()=>{
      if(calls++===0){if(first==='network')throw new TypeError('network');return {status:first};}
      return {status:201};
    }});
    assert.equal(response.status,201);assert.equal(calls,2);assert.deepEqual(delays,[350]);
  }
});
test('expired and unauthorized subscriptions are never retried',async()=>{
  for(const status of [401,403,404,410]) {
    let calls=0;
    const result=await postPush('https://example.invalid',{}, {request:async()=>{calls++;return{status};}});
    assert.equal(result.status,status);assert.equal(calls,1);
  }
});
test('long Retry-After is respected and persistent errors stop after two attempts',async()=>{
  let calls=0;
  await postPush('https://example.invalid',{}, {request:async()=>{calls++;return{status:429,headers:{get:()=> '60'}};}});
  assert.equal(calls,1);calls=0;
  await assert.rejects(()=>postPush('https://example.invalid',{}, {wait:async()=>{},request:async()=>{calls++;throw new Error('offline');}}),/offline/);
  assert.equal(calls,2);
});
