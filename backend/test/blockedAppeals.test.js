import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import { auth, hashPassword } from "../src/auth.js";
import { Account } from "../src/models.js";
import { BlockedAppeal } from "../src/blockedAppeals.js";
import { accountModeration } from "../src/accountModeration.js";
import { masterCategories, masterRecipientFilter } from "../src/masterNotificationAccess.js";

const id = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
async function listen(t, router, user) {
  const app = express();
  app.use(express.json());
  if (user) app.use((req,_res,next)=>{req.user=user;next()});
  app.use(router);
  app.use((error,_req,res,_next)=>res.status(error.status||500).json({error:error.message}));
  const server=app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  t.after(()=>server.close());
  return "http://127.0.0.1:"+server.address().port;
}
const body=(extra={})=>({role:"cliente",phone:"69999999999",password:"ValidPwd123",
  message:"Peço a revisão do bloqueio. Gostaria de esclarecer o ocorrido.",...extra});
async function mockBlockedUser(t,{blocked=true}={}) {
  const hash=await hashPassword("ValidPwd123");
  const user={_id:id,phone:"69999999999",name:"Cliente Teste",role:"cliente",
    blockedAt:blocked?new Date():null,passwordHash:hash};
  t.mock.method(Account,"findOne",()=>({select:async()=>user}));
  return user;
}
async function send(base,path,payload) {
  return fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)});
}
test("pedido de revisão exige senha válida e conta realmente bloqueada",async t=>{
  await mockBlockedUser(t);
  const base=await listen(t,auth);
  const wrong=await send(base,"/blocked-appeal",body({password:"senhaerrada"}));
  assert.equal(wrong.status,401);
  const short=await send(base,"/blocked-appeal",body({message:"muito curto"}));
  assert.equal(short.status,400);
});
test("solicitação pendente existente não é duplicada",async t=>{
  await mockBlockedUser(t);
  t.mock.method(BlockedAppeal,"findOne",async()=>({status:"pending"}));
  const base=await listen(t,auth);
  const response=await send(base,"/blocked-appeal",body());
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.status,"pending");
  assert.equal(result.ok,true);
});
test("titular bloqueado consulta resposta administrativa sem iniciar sessão",async t=>{
  await mockBlockedUser(t);
  t.mock.method(BlockedAppeal,"findOne",()=>({
    sort:()=>({lean:async()=>({status:"reviewed",
      reviewNote:"Analisamos a solicitação e mantivemos o bloqueio.",
      createdAt:new Date("2026-11-19T12:00:00Z")})})
  }));
  const base=await listen(t,auth);
  const response=await send(base,"/blocked-appeal/status",body());
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.status,"reviewed");
  assert.match(result.reviewNote,/mantivemos/);
});
test("conta ativa não usa o fluxo reservado para contas bloqueadas",async t=>{
  await mockBlockedUser(t,{blocked:false});
  const base=await listen(t,auth);
  assert.equal((await send(base,"/blocked-appeal",body())).status,409);
});
test("somente Master Principal consulta e responde pedidos",async t=>{
  const staff={role:"master",_id:id,staffAccountId:String(id),
    staffPermissions:["users.view","support.view","notifications.view"]};
  const baseStaff=await listen(t,accountModeration,staff);
  assert.equal((await fetch(baseStaff+"/master/accounts/appeals")).status,403);
  const baseMaster=await listen(t,accountModeration,{role:"master",_id:id});
  const responseWithoutText=await send(baseMaster,
    "/master/accounts/appeals/"+String(id)+"/review",{reviewNote:"curto"});
  assert.equal(responseWithoutText.status,400);
  let update;
  t.mock.method(BlockedAppeal,"findOneAndUpdate",async (...args)=>{
    update=args;return {_id:id,status:"reviewed"};
  });
  const reviewed=await send(baseMaster,"/master/accounts/appeals/"+String(id)+"/review",
    {reviewNote:"Após avaliação, o bloqueio será mantido."});
  assert.equal(reviewed.status,200);
  assert.equal(update[0].status,"pending");
  assert.equal(update[1].$set.status,"reviewed");
});
test("solicitações de bloqueio notificam apenas o Master Principal",()=>{
  assert.equal(masterCategories({role:"master"}).includes("revisao-conta"),true);
  assert.equal(masterCategories({role:"master",staffAccountId:"staff",
    staffPermissions:["notifications.view","dashboard.view"]}).includes("revisao-conta"),false);
  assert.deepEqual(masterRecipientFilter("revisao-conta"),{$or:[{role:"master"}]});
});

test("somente uma solicitação pendente por conta pode existir", () => {
  const indexes=BlockedAppeal.schema.indexes();
  assert.ok(indexes.some(([keys,options]) => keys.userId===1 &&
    keys.status===1 && options.unique === true && options.partialFilterExpression?.status === "pending"));
});
