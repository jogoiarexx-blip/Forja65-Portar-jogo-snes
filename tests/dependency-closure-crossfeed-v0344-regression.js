'use strict';
const assert=require('assert');const C=require('../forja65-core.js');
let d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0);d.set([0x10,0x80,0x14,0x80,0x18,0x80],0x0A);d[0x10]=0x60;d[0x14]=0x60;d[0x18]=0x60;d[0x20]=0x60;
const rom=C.loadRom(d,'dependency-closure.sfc'),hash=C.romFingerprint(rom);const fp=(a,b)=>{const x=[];for(let p=a;p<b;p++)x.push(rom.data[C.snesToRom(rom,p)]);return C.fnv1a64Bytes(x);};
const domain={kind:'bytecode-script-domain-audit',complete:true,index_bounds_proven:true,closed_entries:3,invalid_entries:0,observed_ids_in_closed_entries:[0,1,2],table_entries:3};
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{project:'fixture'},entries:[],dataRegions:[{start:0x00800A,end:0x008010,source:'fixture'}],dispatch:[{site:0x008007,targets:[0x008010,0x008014,0x008018],source:'fixture',resolution:{kind:'inline-structural-table',entries:3,script_domain:domain}}],limits:[]};
const proofs={schema:'forja65.handler-equivalence.v1',rom:hash,dispatcher_site:0x008007,proofs:[
 {target:0x008020,status:'equivalent',scope:'dependency-abi',native_symbol:'fixture::dep',span:{start:0x008020,end:0x008021},span_fingerprint:fp(0x008020,0x008021),evidence_spans:[{start:0x008020,end:0x008021,fingerprint:fp(0x008020,0x008021)}],verification:{result:'PASS',method:'fixture-dep',cases:4},dependencies:[]},
 {target:0x008010,status:'equivalent',scope:'handler-abi',native_symbol:'fixture::handler',span:{start:0x008010,end:0x008011},span_fingerprint:fp(0x008010,0x008011),verification:{result:'PASS',method:'fixture-handler',cases:4},dependencies:[{target:0x008020,required_status:'equivalent'}]}
]};
let plan=C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:proofs});let h=plan.handlers.find(x=>x.target===0x008010);assert(h.equivalence_proven);assert(h.proof.dependency_closure_proven);assert.equal(h.proof.dependencies_verified[0].verified,true);
const missing=JSON.parse(JSON.stringify(proofs));missing.proofs=missing.proofs.filter(p=>p.target!==0x008020);plan=C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:missing});h=plan.handlers.find(x=>x.target===0x008010);assert(!h.equivalence_proven);assert(h.native_body_ready);assert.equal(h.proof.dependency_closure_proven,false);
const bad=JSON.parse(JSON.stringify(proofs));bad.proofs[0].evidence_spans[0].fingerprint='deadbeefdeadbeef';assert.throws(()=>C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:bad}),/evidence span 0 fingerprint mismatch/);
console.log('dependency-closure-crossfeed-v0344-regression: OK');
