import test from "node:test";
import assert from "node:assert/strict";
import { publicUser, isVerifiedDriver } from "../src/models.js";
import { moderationMayProceed } from "../src/accountModeration.js";
import { staffAccessForRequest } from "../src/teamAccess.js";

test("bloqueio não altera aprovações, mas retira a disponibilidade do motorista", () => {
  const user = { _id:"507f1f77bcf86cd799439011", name:"Motorista Teste", phone:"69999999999",
    role:"motorista", status:"approved", blockedAt:new Date(),
    verification:{ status:"approved",plate:"ABC1D23",cnhExpiresAt:new Date("2099-12-31"),
      crlvYear:2099,documents:["cnh","crlv","selfie"].map(kind=>({kind,fileId:"507f1f77bcf86cd799439012"})) } };
  assert.equal(publicUser(user).blocked, true);
  assert.equal(publicUser(user).verified, false);
  assert.equal(isVerifiedDriver(user), false);
  assert.equal(user.status, "approved");
  assert.equal(publicUser({...user, blockedAt:null}).blocked, false);
});
test("bloqueio não pode interromper frete contratado ou em trânsito", () => {
  assert.equal(moderationMayProceed({status:"booked"}), false);
  assert.equal(moderationMayProceed({status:"transit"}), false);
  assert.equal(moderationMayProceed({status:"completed"}), true);
  assert.equal(moderationMayProceed(null), true);
});
test("funcionário não acessa moderação mesmo com permissões amplas", () => {
  const req = (method,path) => ({user:{role:"master",staffAccountId:"team",staffPermissions:["users.view","drivers.manage"],mustChangePassword:false},
    method, originalUrl:"/api"+path, body:{}});
  const id="507f1f77bcf86cd799439011";
  assert.equal(staffAccessForRequest(req("GET","/master/accounts/"+id+"/moderation")),false);
  assert.equal(staffAccessForRequest(req("POST","/master/accounts/"+id+"/moderation")),false);
});
