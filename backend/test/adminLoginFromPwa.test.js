import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import { auth, hashPassword } from "../src/auth.js";
import { Account, Session } from "../src/models.js";

async function serve(t) {
  const app=express();
  app.use(cookieParser(),express.json());
  app.use("/auth",auth);
  app.use((err,_req,res,_next)=>res.status(err.status||500).json({error:err.message}));
  const server=app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  t.after(()=>server.close());
  return "http://127.0.0.1:"+server.address().port;
}
async function login(base,role,phone,password) {
  const response=await fetch(base+"/auth/login",{
    method:"POST",headers:{"Content-Type":"application/json","X-FreteOn-Request":"1"},
    body:JSON.stringify({role,phone,password})
  });
  return {response,data:await response.json()};
}
test("Master validado na entrada Cliente recebe sessão administrativa, não sessão Cliente",async t=>{
  const hash=await hashPassword("Segura123456");
  const account={_id:"507f1f77bcf86cd799439011",name:"Administrador",phone:"69999999999",
    role:"master",status:"approved",passwordHash:hash};
  t.mock.method(Account,"findOne",()=>({select:async()=>account}));
  const issued=[];
  t.mock.method(Session,"create",async row=>{issued.push(row);return row});
  const base=await serve(t);
  const wrong=await login(base,"cliente",account.phone,"senha-invalida");
  assert.equal(wrong.response.status,401);
  assert.equal(wrong.data.adminAccess,undefined);
  assert.equal(issued.length,0);
  const success=await login(base,"cliente",account.phone,"Segura123456");
  assert.equal(success.response.status,200);
  assert.equal(success.data.adminAccess,true);
  assert.equal(success.data.user.role,"master");
  assert.equal(issued.length,1);
  assert.equal(issued[0].adminSession,true);
  assert.match(success.response.headers.get("set-cookie"),/freteon_session_master=/);
  assert.doesNotMatch(success.response.headers.get("set-cookie"),/freteon_session_cliente=/);
});
test("conta Cliente não recebe atalho administrativo mesmo com senha correta",async t=>{
  const hash=await hashPassword("Segura123456");
  const account={_id:"507f1f77bcf86cd799439012",name:"Cliente",phone:"69988888888",
    role:"cliente",status:"approved",passwordHash:hash};
  t.mock.method(Account,"findOne",()=>({select:async()=>account}));
  t.mock.method(Session,"create",async row=>row);
  const base=await serve(t);
  const reply=await login(base,"cliente",account.phone,"Segura123456");
  assert.equal(reply.response.status,200);
  assert.equal(reply.data.adminAccess,undefined);
  assert.equal(reply.data.user.role,"cliente");
});
test("colaborador desabilitado não ganha sessão Master pelo login Cliente",async t=>{
  const hash=await hashPassword("Segura123456");
  const account={_id:"507f1f77bcf86cd799439013",name:"Colaborador",phone:"69977777777",
    role:"staff",status:"approved",staffEnabled:false,passwordHash:hash};
  t.mock.method(Account,"findOne",()=>({select:async()=>account}));
  const base=await serve(t);
  const reply=await login(base,"cliente",account.phone,"Segura123456");
  assert.equal(reply.response.status,403);
  assert.equal(reply.data.adminAccess,undefined);
  assert.equal(reply.response.headers.get("set-cookie"),null);
});
