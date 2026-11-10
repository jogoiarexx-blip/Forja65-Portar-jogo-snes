'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');
let d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);
// REP #$30; AND #$007F; ASL; TAX; JMP ($800A,X)
d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0x0000);
d.set([0x10,0x80,0x14,0x80,0x18,0x80],0x000A);
d[0x0010]=0x60;d[0x0014]=0x60;d[0x0018]=0x60;
const rom=C.loadRom(d,'handler-proof.sfc'),hash=C.romFingerprint(rom);
const domain={kind:'bytecode-script-domain-audit',complete:true,index_bounds_proven:true,closed_entries:3,invalid_entries:0,observed_ids_in_closed_entries:[0,1,2],table_entries:3};
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{project:'fixture'},entries:[],dataRegions:[{start:0x00800A,end:0x008010,source:'fixture'}],dispatch:[{site:0x008007,targets:[0x008010,0x008014,0x008018],source:'fixture',resolution:{kind:'inline-structural-table',entries:3,script_domain:domain}}],limits:[]};
function fp(start,end){const bytes=[];for(let a=start;a<end;a++)bytes.push(rom.data[C.snesToRom(rom,a)]);return C.fnv1a64Bytes(bytes);}
const proofs={schema:'forja65.handler-equivalence.v1',rom:hash,dispatcher_site:0x008007,proofs:[
 {target:0x008010,status:'equivalent',scope:'handler-abi',native_symbol:'fixture::handler0',span:{start:0x008010,end:0x008011},span_fingerprint:fp(0x008010,0x008011),verification:{result:'PASS',method:'fixture-oracle',cases:64},dependencies:[]},
 {target:0x008014,status:'dependency-boundary',scope:'pre-call-boundary',native_symbol:'fixture::handler1',span:{start:0x008014,end:0x008015},span_fingerprint:fp(0x008014,0x008015),verification:{result:'PASS',method:'fixture-boundary',cases:1},dependencies:[{target:0x008100,equivalence_proven:false}]}
]};
const plan=C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:proofs});
const h0=plan.handlers.find(h=>h.target===0x008010),h1=plan.handlers.find(h=>h.target===0x008014),h2=plan.handlers.find(h=>h.target===0x008018);
assert(h0.equivalence_proven&&h0.native_body_ready);assert.equal(h0.proof.status,'equivalent');
assert(!h1.equivalence_proven&&h1.native_body_ready);assert.equal(h1.proof.status,'dependency-boundary');
assert(!h2.equivalence_proven&&!h2.native_body_ready);
assert.equal(plan.cutover.partial_handler_execution_ready,true);assert.equal(plan.cutover.handler_execution_ready,false);
assert.equal(plan.cutover.semantic_handlers_proven,1);assert.equal(plan.cutover.dependency_boundary_handlers,1);
const cpp=C.nativeDispatchCpp(plan,{namespace:'fixture_generated'});assert(cpp.includes('bool native_body_ready; bool equivalence_proven'));
const bad=JSON.parse(JSON.stringify(proofs));bad.proofs[0].span_fingerprint='0000000000000000';
assert.throws(()=>C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:bad}),/span fingerprint mismatch/);
const wrong=JSON.parse(JSON.stringify(proofs));wrong.rom='deadbeefdeadbeef';
assert.throws(()=>C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:wrong}),/ROM mismatch/);
console.log('handler-equivalence-crossfeed-v0343-regression: OK');
