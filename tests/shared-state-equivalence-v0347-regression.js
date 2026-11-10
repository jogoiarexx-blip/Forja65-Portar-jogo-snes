'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');
let d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);
// REP #$30; AND #$007F; ASL; TAX; JMP ($800A,X)
d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0x0000);
d.set([0x10,0x80,0x14,0x80,0x18,0x80],0x000A);d[0x0010]=0x60;d[0x0014]=0x60;d[0x0018]=0x60;
const rom=C.loadRom(d,'shared-state-equivalence.sfc'),hash=C.romFingerprint(rom);
const domain={kind:'bytecode-script-domain-audit',complete:true,index_bounds_proven:true,closed_entries:3,invalid_entries:0,observed_ids_in_closed_entries:[0,1,2],table_entries:3,command_hits:{'0':20,'1':5,'2':1}};
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{project:'fixture'},entries:[],dataRegions:[{start:0x00800A,end:0x008010,source:'fixture'}],dispatch:[{site:0x008007,targets:[0x008010,0x008014,0x008018],source:'fixture',resolution:{kind:'inline-structural-table',entries:2,script_domain:domain}}],limits:[]};
function fp(start,end){const bytes=[];for(let a=start;a<end;a++)bytes.push(rom.data[C.snesToRom(rom,a)]);return C.fnv1a64Bytes(bytes);}
const proof={target:0x008010,status:'equivalent',scope:'handler-abi',native_symbol:'fixture::shared',span:{start:0x008010,end:0x008011},span_fingerprint:fp(0x008010,0x008011),contract:{flow_outcomes:[0x008030,0x008040],shared_state:['wram:$186B(read)','wram:$186D','sprite:linked+$24']},verification:{result:'PASS',method:'fixture-shared',cases:256,continuations:[0x008040,0x008030],shared_state:['sprite:linked+$24','wram:$186D','wram:$186B(read)']},dependencies:[]};
const proofs={schema:'forja65.handler-equivalence.v1',rom:hash,dispatcher_site:0x008007,proofs:[proof]};
let plan=C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:proofs});
let h=plan.handlers.find(x=>x.target===0x008010);assert(h.equivalence_proven);assert(h.proof.shared_state_verified);assert.deepEqual(h.proof.shared_state,['sprite:linked+$24','wram:$186B(read)','wram:$186D']);
const bad=JSON.parse(JSON.stringify(proofs));bad.proofs[0].verification.shared_state=['wram:$186B(read)','wram:$186D'];
assert.throws(()=>C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:bad}),/shared-state proof ABI mismatch/);
const missing=JSON.parse(JSON.stringify(proofs));delete missing.proofs[0].verification.shared_state;
assert.throws(()=>C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:missing}),/shared-state proof ABI mismatch/);
console.log('shared-state-equivalence-v0347-regression: OK');
