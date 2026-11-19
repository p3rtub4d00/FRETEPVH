import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { freightCommunication, canInspectFreightChat } from "../src/freightCommunication.js";
import { Freight, FreightChat } from "../src/models.js";
import { TeamAuditEvent } from "../src/teamAccess.js";
const id="507f1f77bcf86cd799439011";
const owner={_id:id,role:"master"};
const staff={_id:"507f1f77bcf86cd799439012",role:"master",staffAccountId:"507f1f77bcf86cd799439012",teamRole:"atendimento",staffPermissions:["freights.view","support.view"]};
async function openServer(t,user){
  const app=express();
  app.use((req,res,next)=>{req.user=user;next()});
  app.use(freightCommunication);
  app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
  const server=app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  t.after(()=>server.close());
  return "http://127.0.0.1:"+server.address().port;
}
test("Master proprietário ou suporte autorizado pode consultar chat",async t=>{
  assert.equal(canInspectFreightChat(owner),true);
  assert.equal(canInspectFreightChat(staff),true);
  assert.equal(canInspectFreightChat({...staff,staffPermissions:["finance.view"]}),false);
  assert.equal(canInspectFreightChat({role:"cliente"}),false);
  const base=await openServer(t,{...staff,staffPermissions:["freights.view"]});
  const response=await fetch(base+"/master/freights/"+id+"/chat");
  assert.equal(response.status,403);
});
test("consulta auditada retorna chat somente leitura e não faz cache",async t=>{
  t.mock.method(Freight,"findById",async()=>({_id:id}));
  const message={_id:"507f1f77bcf86cd799439013",authorId:"client",authorRole:"cliente",content:"Estou no local.",createdAt:new Date("2026-11-19T10:00:00Z")};
  t.mock.method(FreightChat,"find",()=>({sort:()=>({limit:()=>({lean:async()=>[message]})})}));
  const events=[];
  t.mock.method(TeamAuditEvent,"create",async row=>{events.push(row);return row});
  const base=await openServer(t,owner);
  const response=await fetch(base+"/master/freights/"+id+"/chat");
  assert.equal(response.status,200);
  assert.match(response.headers.get("cache-control"),/no-store/);
  const data=await response.json();
  assert.equal(data.messages[0].content,"Estou no local.");
  assert.equal(events.length,1);
  assert.equal(events[0].method,"GET");
  assert.equal(events[0].targetId,id);
  assert.equal((await fetch(base+"/master/freights/"+id+"/chat?before=invalid")).status,400);
});
test("não envia mensagens se falhar a auditoria",async t=>{
  t.mock.method(Freight,"findById",async()=>({_id:id}));
  t.mock.method(FreightChat,"find",()=>({sort:()=>({limit:()=>({lean:async()=>[]})})}));
  t.mock.method(TeamAuditEvent,"create",async()=>{throw Error("unavailable")});
  const base=await openServer(t,owner);
  const response=await fetch(base+"/master/freights/"+id+"/chat");
  assert.equal(response.status,503);
  assert.equal((await response.json()).messages,undefined);
});
