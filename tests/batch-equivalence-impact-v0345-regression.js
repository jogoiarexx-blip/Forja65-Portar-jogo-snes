'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');
let d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);
// REP #$30; AND #$007F; ASL; TAX; JMP ($800A,X)
d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0x0000);
d.set([0x10,0x80,0x14,0x80,0x18,0x80],0x000A);
d[0x0010]=0x60;d[0x0014]=0x60;d[0x0018]=0x60;
const rom=C.loadRom(d,'batch-equivalence-impact.sfc'),hash=C.romFingerprint(rom);
const domain={kind:'bytecode-script-domain-audit',complete:true,index_bounds_proven:true,closed_entries:3,invalid_entries:0,observed_ids_in_closed_entries:[0,1,2],table_entries:3,command_hits:{'0':100,'1':25,'2':5}};
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{project:'fixture'},entries:[],dataRegions:[{start:0x00800A,end:0x008010,source:'fixture'}],dispatch:[{site:0x008007,targets:[0x008010,0x008014,0x008018],source:'fixture',resolution:{kind:'inline-structural-table',entries:3,script_domain:domain}}],limits:[]};
function fp(start,end){const bytes=[];for(let a=start;a<end;a++)bytes.push(rom.data[C.snesToRom(rom,a)]);return C.fnv1a64Bytes(bytes);}
const proofs={schema:'forja65.handler-equivalence.v1',rom:hash,dispatcher_site:0x008007,proofs:[
 {target:0x008010,status:'equivalent',scope:'handler-abi',native_symbol:'fixture::h0',span:{start:0x008010,end:0x008011},span_fingerprint:fp(0x008010,0x008011),verification:{result:'PASS',cases:100},dependencies:[]},
 {target:0x008018,status:'equivalent',scope:'handler-abi',native_symbol:'fixture::h2',span:{start:0x008018,end:0x008019},span_fingerprint:fp(0x008018,0x008019),verification:{result:'PASS',cases:5},dependencies:[]}
]};
const plan=C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:proofs});
assert.equal(plan.cutover.semantic_handlers_proven,2);
const cov=plan.cutover.structural_script_hit_coverage;
assert.equal(cov.available,true);assert.equal(cov.total_hits,130);assert.equal(cov.native_hits,105);assert.equal(cov.candidate_hits,130);
assert(Math.abs(cov.native_fraction-(105/130))<1e-12);
assert.deepEqual(cov.proven_command_ids,[0,2]);
assert.equal(cov.next_unproven_handlers.length,1);assert.equal(cov.next_unproven_handlers[0].target,0x008014);assert.equal(cov.next_unproven_handlers[0].script_hits,25);
assert.equal(plan.handler_impact[0].target,0x008010);assert.equal(plan.handler_impact[0].script_hits,100);
console.log('batch-equivalence-impact-v0345-regression: OK');
