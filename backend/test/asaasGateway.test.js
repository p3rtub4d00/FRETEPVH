import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseGateway, PaymentReservation} from '../src/paymentGateway.js';
import {MercadoPagoOrder} from '../src/mercadoPago.js';
import {PagBankOrder} from '../src/pagBank.js';
import {AsaasOrder} from '../src/asaas.js';
const req={params:{id:'507f1f77bcf86cd799439012',kind:'freight'}};
test('existing Asaas charge stays at Asaas even after Master switches preference',async t=>{
 t.mock.method(MercadoPagoOrder,'exists',async()=>null);t.mock.method(PagBankOrder,'exists',async()=>null);
 t.mock.method(AsaasOrder,'exists',async()=>({_id:'a'}));t.mock.method(PaymentReservation,'findOne',()=>({lean:async()=>null}));
 assert.equal(await chooseGateway(req),'asaas');
});
test('ambiguous charge across providers is blocked',async t=>{
 t.mock.method(MercadoPagoOrder,'exists',async()=>({_id:'m'}));t.mock.method(PagBankOrder,'exists',async()=>null);
 t.mock.method(AsaasOrder,'exists',async()=>({_id:'a'}));t.mock.method(PaymentReservation,'findOne',()=>({lean:async()=>null}));
 await assert.rejects(()=>chooseGateway(req),/dois provedores/);
});
test('reserved bank remains fixed for overlapping requests before the charge exists',async t=>{
 for(const model of [MercadoPagoOrder,PagBankOrder,AsaasOrder])t.mock.method(model,'exists',async()=>null);
 t.mock.method(PaymentReservation,'findOne',()=>({lean:async()=>({provider:'asaas'})}));
 assert.equal(await chooseGateway(req,true),'asaas');
});
