'use strict';
const assert=require('assert'),C=require('../forja65-core.js');
const bytes=C.makeSyntheticRom();bytes.fill(0xEA,0,0x200);bytes.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0);bytes.set([0x10,0x80,0x20,0x80,0x30,0x80],10);bytes.set([0x6C,0x42,0],16);bytes[32]=0x60;bytes[48]=0x60;
const rom=C.loadRom(bytes,'subdomain.sfc'),hash=C.romFingerprint(rom),fp=(a,b)=>C.fnv1a64Bytes(bytes.slice(a-0x8000,b-0x8000));
const calls=[{site:0x8010,targets:[0x8020,0x8030]}],sub=[{site:0x8010,targets:[0x8020]}];
const knowledge={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},entries:[],dataRegions:[{start:0x800A,end:0x8010}],dispatch:[{site:0x8007,targets:[0x8010,0x8020,0x8030],resolution:{kind:'inline-structural-table',entries:3,script_domain:{complete:true,index_bounds_proven:true,observed_ids_in_closed_entries:[0,1,2],table_entries:3}}},{site:0x8010,targets:[0x8020,0x8030]}],limits:[]};
const q={schema:'forja65.handler-equivalence.v1',rom:hash,dispatcher_site:0x8007,proofs:[{target:0x8020,status:'equivalent',scope:'handler-abi',span:{start:0x8020,end:0x8021},span_fingerprint:fp(0x8020,0x8021),contract:{cursor_effects:['preserve','add3-wrap16']},verification:{result:'PASS',cases:4,original_dependencies_executed:true},dependencies:[]}]};
const run=p=>C.nativeDispatchPlan(rom,0x8007,knowledge,{handlerProofs:p,handlerMax:64});
assert.throws(()=>run(q),/cursor effect/i,'a proof claiming cursor mutation must supply partitioned original case evidence');
q.proofs[0].verification.cursor_effect_cases=[{effect:'preserve',cases:2},{effect:'add3-wrap16',cases:2}];
assert(run(q).handlers.find(h=>h.target===0x8020).equivalence_proven);
for(const evidence of [[{effect:'preserve',cases:4}],[{effect:'preserve',cases:2},{effect:'add3-wrap16',cases:0}],[{effect:'preserve',cases:2},{effect:'add3-wrap16',cases:3}],[{effect:'preserve',cases:2},{effect:'preserve',cases:2}]]){
 const bad=structuredClone(q);bad.proofs[0].verification.cursor_effect_cases=evidence;assert.throws(()=>run(bad),/cursor effect/i);
}
const nativeOnly=structuredClone(q);nativeOnly.proofs[0].verification.original_dependencies_executed=false;assert.throws(()=>run(nativeOnly),/cursor effect/i);
// Conditional handlers use the same gate; checking only complete proofs
// would miss the actual command-0 cutover route.
const specialization={key:'original-leaf',contract:{indirect_calls:sub,flow_outcomes:[0x8040],shared_state:[],cursor_effects:['preserve','add3-wrap16']},verification:{result:'PASS',cases:4,original_dependencies_executed:true,indirect_calls:sub,continuations:[0x8040],shared_state:[],target_cases:[{site:0x8010,target:0x8020,cases:4}]},dependencies:[{target:0x8020}]};
const boundary={target:0x8010,status:'dependency-boundary',scope:'handler-abi',span:{start:0x8010,end:0x8013},span_fingerprint:fp(0x8010,0x8013),contract:{indirect_calls:calls},verification:{result:'PASS',cases:4,indirect_calls:calls},dependencies:[{target:0x8020},{target:0x8030}],specializations:[specialization]};
const partial=structuredClone(q);partial.proofs.push(boundary);
assert.throws(()=>run(partial),/cursor effect/i);
partial.proofs[1].specializations[0].verification.cursor_effect_cases=[{effect:'preserve',cases:2},{effect:'add3-wrap16',cases:2}];
assert.strictEqual(run(partial).handlers.find(h=>h.target===0x8010).authorized_subdomains.length,1);
console.log('cursor-effects-v0358-regression: OK');
