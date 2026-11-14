import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { api } from '../src/api.js';
import { Account, Freight } from '../src/models.js';

for (const lookupFails of [false, true]) test(`saved request returns success even with ${lookupFails ? 'notification lookup failure' : 'approved drivers'}`, async t => {
  let saved = 0;
  t.mock.method(Freight, 'create', async data => { saved++; return new Freight(data); });
  t.mock.method(Account, 'find', () => ({ limit: async () => {
    if (lookupFails) throw new Error('lookup unavailable');
    return [{ _id: '507f1f77bcf86cd799439012', role: 'motorista', status: 'approved', verification: {
      status: 'approved', plate: 'ABC1D23', cnhExpiresAt: new Date('2099-12-31'), crlvYear: 2099,
      documents: ['cnh','crlv','selfie'].map(kind=>({kind,fileId:'507f1f77bcf86cd799439013'})),
    } }];
  } }));
  const oldPublic=process.env.VAPID_PUBLIC_KEY, oldMaps=process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.VAPID_PUBLIC_KEY; delete process.env.GOOGLE_MAPS_API_KEY;
  t.after(()=>{ if(oldPublic!==undefined)process.env.VAPID_PUBLIC_KEY=oldPublic; if(oldMaps!==undefined)process.env.GOOGLE_MAPS_API_KEY=oldMaps; });
  const route=api.stack.find(layer=>layer.route?.path==='/requests'&&layer.route.methods.post).route;
  const app=express();app.use(express.json());
  app.use((req,res,next)=>{req.user={_id:'507f1f77bcf86cd799439011',role:'cliente'};next()});
  app.post('/requests',...route.stack.map(layer=>layer.handle));
  app.use((error,req,res,next)=>res.status(error.status||500).json({error:error.message}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
  const response=await fetch(`http://127.0.0.1:${server.address().port}/requests`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Sofá',description:'Um sofá de dois lugares',origin:'Rua de origem, 123',destination:'Rua de destino, 456',date:'2099-12-01',time:'12:00',paymentMethod:'pix_freteon',photos:[]})});
  const data=await response.json();
  assert.equal(saved,1);
  assert.equal(response.status,201,JSON.stringify(data));
  assert.ok(data.request.id);assert.equal(data.request.status,'open');
});
