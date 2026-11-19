import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { masterCategories, masterRecipientFilter } from '../src/masterNotificationAccess.js';
import { masterNotifications, recordMasterNotification } from '../src/masterNotifications.js';
import { notifyMasters } from '../src/webPush.js';
import { Account } from '../src/models.js';
const Event = mongoose.model('FreteOnMasterNotification');
const handler = (path, method) => masterNotifications.stack.find(x => x.route?.path === path && x.route.methods[method]).route.stack.at(-1).handle;
const owner = { _id: 'owner', role: 'master' };

test('notification audience includes authorized active staff, never password recovery for staff', () => {
  const staff = {role:'master',staffAccountId:'staff',staffPermissions:['notifications.view','finance.view']};
  assert.deepEqual(masterCategories(staff), ['financeiro']);
  assert.equal(masterCategories(owner).includes('recuperacao'), true);
  assert.deepEqual(masterCategories({...staff,staffPermissions:[]}), []);
  const filter = masterRecipientFilter('financeiro');
  assert.equal(filter.$or[1].staffEnabled, true);
  assert.equal(filter.$or[1].status, 'approved');
  assert.deepEqual(filter.$or[1].staffPermissions.$all, ['notifications.view','finance.view']);
  assert.deepEqual(masterRecipientFilter('recuperacao'), {$or:[{role:'master'}]});
});

test('unread totals are independent of the 100 displayed items and scoped to the user', async t => {
  t.mock.method(Event,'find', filter => {
    assert.ok(filter.category.$in.includes('financeiro'));
    return {sort:()=>({limit:n=>{assert.equal(n,100);return {lean:async()=>[{_id:'a',category:'financeiro',readBy:['other']}]};}})};
  });
  t.mock.method(Event,'aggregate',async pipeline => {
    assert.equal(pipeline[0].$match.readBy.$ne, 'owner');
    return [{_id:'financeiro',count:135},{_id:'fretes',count:7}];
  });
  let result;
  await handler('/master/notifications','get')({user:owner},{setHeader(){},json:x=>result=x});
  assert.equal(result.unread,142);
  assert.equal(result.unreadByCategory.financeiro,135);
  assert.equal(result.items[0].read,false);
});

test('mark all uses the displayed snapshot so newly arriving notifications stay unread',async t=>{
  const before='507f1f77bcf86cd799439011';let filter;
  t.mock.method(Event,'updateMany',async (query,update)=>{filter=query;assert.equal(update.$addToSet.readBy,'owner');});
  await handler('/master/notifications/read-all','post')({user:owner,body:{before}},{json(){}});
  assert.equal(String(filter._id.$lte),before);
  await assert.rejects(()=>handler('/master/notifications/read-all','post')({user:owner,body:{}},{json(){}}),/Atualize/);
});

test('failure to record the Master inbox does not suppress the push attempt',async t=>{
  t.mock.method(Event,'create',async()=>{throw new Error('database failure');});
  let queried=false;
  t.mock.method(Account,'find',filter=>{queried=true;assert.equal(filter.$or[0].role,'master');return{select:()=>({lean:async()=>[]})};});
  const result=await notifyMasters({title:'Teste',category:'fretes'});
  assert.equal(queried,true);
  assert.ok(result);
});

test('verificação de celular gera aviso próprio acessível apenas ao Master Principal', async t => {
  assert.ok(masterCategories(owner).includes('verificacao-telefone'));
  const staff = {role:'master',staffAccountId:'staff',staffPermissions:[
    'notifications.view','dashboard.view','drivers.view']};
  assert.ok(!masterCategories(staff).includes('verificacao-telefone'));
  assert.deepEqual(masterRecipientFilter('verificacao-telefone'), {$or:[{role:'master'}]});
  let recorded;
  t.mock.method(Event,'create',async value => {recorded=value;return {_id:'507f1f77bcf86cd799439011'};});
  await recordMasterNotification({title:'Verificação de celular solicitada',
    body:'Solicitação de confirmação.',category:'verificacao-telefone',
    id:'507f1f77bcf86cd799439012'});
  assert.equal(recorded.category,'verificacao-telefone');
  assert.equal(recorded.targetId,'507f1f77bcf86cd799439012');
});
