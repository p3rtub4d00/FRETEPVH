import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyAddress, normalizeAddress, formatAddress, mapsRouteUrl } from '../../frontend/src/addressFormat.js';
const address = {...emptyAddress(),street:'Rua São João',number:'123',neighborhood:'Centro',complement:'Bloco A',reference:'Ao lado da praça'};
test('address separates navigation from delivery instructions',()=>{
 const a=normalizeAddress(address);
 const formatted=formatAddress(a);
 assert.equal(formatted,'Rua São João, 123 - Centro, Porto Velho - RO, Brasil');
 const url=new URL(mapsRouteUrl(formatted,'Avenida Brasil, 456 - Centro, Porto Velho - RO, Brasil'));
 assert.equal(url.searchParams.get('origin'),formatted);
 assert.equal(url.searchParams.get('api'),'1');
 assert.equal(url.searchParams.has('key'),false);
});
test('missing number is explicit and required fields are checked',()=>{
 assert.throws(()=>normalizeAddress({...address,number:''}));
 const a=normalizeAddress({...address,number:'',noNumber:true});
 assert.ok(formatAddress(a).includes('s/n'));
 for(const bad of [{street:''},{neighborhood:''},{city:''},{state:'ZZ'}]) assert.throws(()=>normalizeAddress({...address,...bad}));
});
