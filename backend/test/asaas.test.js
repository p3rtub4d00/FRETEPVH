import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { AsaasOrder, AsaasEvent, asaasRequest, asaasPaymentStatus, validateAsaasPayment, verifyAsaasWebhook, syncAsaasOrder, publicAsaasOrder, asaasWebhook } from '../src/asaas.js';
import { providerReady } from '../src/paymentProviderSettings.js';
import { Freight, Account } from '../src/models.js';
import { isRealBankPayment, confirmDelivery } from '../src/finance.js';
const baseOrder = () => ({_id:'507f1f77bcf86cd799439011',freightId:'507f1f77bcf86cd799439012',kind:'freight',payerId:'client',customerId:'cus_test',paymentId:'pay_test',externalReference:'freteon-test',amountCents:10000,environment:'production',status:'pending',reviewRequired:false});
const payment = (status='RECEIVED') => ({id:'pay_test',customer:'cus_test',externalReference:'freteon-test',billingType:'PIX',value:100,status});
const freight = () => ({_id:'507f1f77bcf86cd799439012',clientId:'client',driverId:'driver',agreedPriceCents:10000,commissionCents:1000,paymentMethod:'pix_freteon',paymentStatus:'awaiting',status:'booked',refundStatus:'none',payoutStatus:'none',disputeStatus:'none',commissionStatus:'none'});
function env(t){for(const [k,v] of Object.entries({ASAAS_ENABLED:'true',ASAAS_ENV:'production',ASAAS_API_KEY:'test-local-key',ASAAS_WEBHOOK_TOKEN:'a'.repeat(64),ASAAS_PUBLIC_URL:'https://fretepvh.onrender.com'})){const old=process.env[k];process.env[k]=v;t.after(()=>old===undefined?delete process.env[k]:process.env[k]=old);}}
test('Asaas requires production, key and webhook secret; it never falls back to sandbox',t=>{
 env(t);assert.equal(providerReady('asaas'),true);process.env.ASAAS_API_KEY='';assert.equal(providerReady('asaas'),false);
 process.env.ASAAS_API_KEY='test';process.env.ASAAS_ENV='sandbox';assert.equal(providerReady('asaas'),false);
});
test('Asaas sends credentials only to fixed production endpoint and never retries a charge POST',async t=>{
 env(t);let calls=0;
 t.mock.method(globalThis,'fetch',async(url,opts)=>{calls++;assert.equal(url,'https://api.asaas.com/v3/payments');assert.equal(opts.headers.access_token,'test-local-key');assert.equal(opts.redirect,'error');throw new Error('timeout');});
 await assert.rejects(()=>asaasRequest('POST','/payments',{value:100}),/confirmar/);assert.equal(calls,1);
});
test('Asaas reconciliation rejects wrong amount, payer, reference, method and environment',()=>{
 for(const changes of [{id:'pay_other'},{customer:'cus_other'},{externalReference:'other'},{value:99.99},{value:'100'},{billingType:'CREDIT_CARD'}])assert.equal(validateAsaasPayment(baseOrder(),{...payment(),...changes}),false);
 assert.equal(validateAsaasPayment({...baseOrder(),environment:'sandbox'},payment()),false);
 assert.equal(validateAsaasPayment(baseOrder(),payment()),true);
});
test('CONFIRMED is not settled money; refunds require DONE and full value',()=>{
 assert.equal(asaasPaymentStatus(payment('CONFIRMED')),'pending');assert.equal(asaasPaymentStatus(payment()),'approved');
 assert.equal(asaasPaymentStatus({...payment('REFUNDED'),refunds:[{status:'PENDING',value:100}]}),'review');
 assert.equal(asaasPaymentStatus({...payment('REFUNDED'),refunds:[{status:'DONE',value:50}]}),'review');
 assert.equal(asaasPaymentStatus({...payment('REFUNDED'),refunds:[{status:'DONE',value:100}]}),'refunded');
 assert.equal(publicAsaasOrder({...baseOrder(),status:'refunded',qrCode:'stale'}).qrCode,'');
});
function mockTransaction(t,order,f){
 order.save=async()=>{};f.save=async()=>{};
 t.mock.method(mongoose,'startSession',async()=>({withTransaction:async fn=>fn(),endSession:async()=>{}}));
 t.mock.method(AsaasOrder,'findById',()=>({session:async()=>order,lean:async()=>order}));
 t.mock.method(Freight,'findById',()=>({session:async()=>f,lean:async()=>f,then:resolve=>Promise.resolve(f).then(resolve)}));
 t.mock.method(Account,'find',()=>({select:()=>({lean:async()=>[]})}));
 t.mock.method(mongoose.model('FreteOnMasterNotification'),'create',async()=>({_id:'event'}));
}
test('settlement is applied once, unlocks transport, and an older pending event cannot undo it',async t=>{
 const o=baseOrder(),f=freight();mockTransaction(t,o,f);
 await syncAsaasOrder(o,payment());assert.equal(f.paymentStatus,'paid_asaas');assert.equal(isRealBankPayment(f),true);
 await syncAsaasOrder(o,payment());assert.equal(o.reviewRequired,false);
 await syncAsaasOrder(o,payment('PENDING'));assert.equal(o.status,'approved');assert.equal(f.paymentStatus,'paid_asaas');
 f.status='completed';confirmDelivery(f);assert.equal(f.payoutStatus,'available');
});
test('late payment on cancelled freight is flagged, never unlocks driver funds',async t=>{
 const o=baseOrder(),f={...freight(),status:'cancelled'};mockTransaction(t,o,f);
 await syncAsaasOrder(o,payment());assert.equal(o.reviewRequired,true);assert.equal(f.paymentStatus,'awaiting');assert.equal(f.payoutStatus,'none');assert.equal(f.disputeStatus,'open');
});
test('commission settlement updates real commission totals',async t=>{
 const o={...baseOrder(),kind:'commission',payerId:'driver',amountCents:1000};const f={...freight(),paymentMethod:'cash_driver',commissionStatus:'pending'};mockTransaction(t,o,f);
 await syncAsaasOrder(o,{...payment(),value:10});assert.equal(f.commissionStatus,'paid');assert.equal(f.commissionProvider,'asaas');assert.equal(f.commissionProviderEnvironment,'production');
});
test('full confirmed refund cancels freight and blocks payout; duplicate cannot apply twice',async t=>{
 const o={...baseOrder(),status:'approved'},f={...freight(),paymentStatus:'paid_asaas',refundStatus:'approved'};mockTransaction(t,o,f);
 const remote={...payment('REFUNDED'),refunds:[{status:'DONE',value:100}]};
 await syncAsaasOrder(o,remote);assert.equal(f.paymentStatus,'refunded_asaas');assert.equal(f.payoutStatus,'none');assert.equal(f.commissionStatus,'waived');
 await syncAsaasOrder(o,remote);assert.equal(o.reviewRequired,false);
});
test('unauthenticated webhook cannot persist a fake payment; duplicates are acknowledged',async t=>{
 const secret='a'.repeat(64);assert.equal(verifyAsaasWebhook('wrong',secret),false);assert.equal(verifyAsaasWebhook(secret,secret),true);
 env(t);process.env.ASAAS_ENABLED='false';let created=0;let status;
 t.mock.method(AsaasEvent,'create',async()=>{created++;throw Object.assign(new Error('duplicate'),{code:11000});});
 const handler=asaasWebhook.stack[0].route.stack[0].handle;
 const body={id:'evt_test',payment:{id:'pay_test',externalReference:'ref'}};
 await handler({get:()=> 'wrong',body},{sendStatus:x=>status=x});assert.equal(status,401);assert.equal(created,0);
 await handler({get:()=>secret,body},{sendStatus:x=>status=x});assert.equal(status,200);assert.equal(created,1);
});

test('Pix creation uses server amount, recovers timeout by reference and never creates a second payment',async t=>{
 env(t);
 const {asaasCreate}=await import('../src/asaas.js');
 const o={...baseOrder(),paymentId:'',status:'created',customerId:'',attemptedAt:null};const f=freight();
 mockTransaction(t,o,f);
 // Existing local reservation, but no external payment yet.
 t.mock.method(AsaasOrder,'findOne',async()=>o);
 t.mock.method(AsaasOrder,'updateOne',async(_query,update)=>{Object.assign(o,update.$set);return{modifiedCount:1};});
 let posts=0,first=true;
 t.mock.method(globalThis,'fetch',async(url,opts)=>{
   let data;
   if(url.endsWith('/webhooks?limit=100'))data={data:[{id:'hook_test',url:'https://fretepvh.onrender.com/api/asaas/webhook',email:'owner@example.com'}]};
   else if(url.endsWith('/webhooks/hook_test')){assert.equal(opts.method,'PUT');data={id:'hook_test'};}
   else if(url.includes('/customers?'))data={data:[{id:'cus_test',externalReference:'client',cpfCnpj:'52998224725'}]};
   else if(url.endsWith('/payments')&&opts.method==='POST'){
     posts++;const body=JSON.parse(opts.body);assert.equal(body.value,100);assert.equal(body.billingType,'PIX');
     if(first){first=false;throw new Error('timeout after bank accepted');}data=payment('PENDING');
   }else if(url.includes('/payments?externalReference='))data={data:[payment('PENDING')]};
   else if(url.endsWith('/pixQrCode'))data={payload:'PIX-CODE',encodedImage:'YWJj',expirationDate:'2026-11-20 23:59:59'};
   else if(url.endsWith('/payments/pay_test'))data=payment('PENDING');
   else assert.fail('unexpected request '+url);
   return{ok:true,json:async()=>data};
 });
 const req={params:{id:o.freightId,kind:'freight'},user:{_id:'client',role:'cliente',name:'Test user',phone:'69999999999'},body:{cpf:'52998224725',email:'payer@example.com',value:0.01}};
 let result;
 await assert.rejects(()=>asaasCreate(req,{json:x=>result=x}),/confirmar/);
 assert.ok(o.attemptedAt);assert.equal(posts,1);
 await asaasCreate(req,{json:x=>result=x});assert.equal(posts,1);assert.equal(result.paymentId,'pay_test');assert.equal(result.qrCode,'PIX-CODE');assert.equal(result.amountCents,10000);
});
