'use strict';
const assert=require('assert');const C=require('../forja65-core.js');
let d=C.makeSyntheticRom();d.fill(0xEA,0,0x300);
// Main 3-entry dispatcher at $008007.
d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0);
d.set([0x10,0x80,0x14,0x80,0x18,0x80],0x0A);d[0x10]=0x60;d[0x14]=0x60;d[0x18]=0x60;
// Callback and dependency dispatcher/table spans used only for proof fingerprints.
d[0x30]=0x60;d.set([0xA4,0x70,0x0A,0xAA,0x7C,0x47,0x80],0x40);d.set([0x50,0x80,0x54,0x80,0x58,0x80],0x47);d[0x50]=0x60;d[0x54]=0x60;d[0x58]=0x60;
const rom=C.loadRom(d,'external-boundary.sfc'),hash=C.romFingerprint(rom);const fp=(a,b)=>{const x=[];for(let p=a;p<b;p++)x.push(rom.data[C.snesToRom(rom,p)]);return C.fnv1a64Bytes(x);};
const domain={kind:'bytecode-script-domain-audit',complete:true,index_bounds_proven:true,closed_entries:3,invalid_entries:0,observed_ids_in_closed_entries:[0,1,2],table_entries:3,command_hits:{'0':10,'1':10,'2':10}};
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{project:'fixture'},entries:[],dataRegions:[{start:0x00800A,end:0x008010,source:'fixture'}],dispatch:[
 {site:0x008007,targets:[0x008010,0x008014,0x008018],source:'fixture',resolution:{kind:'inline-structural-table',entries:3,script_domain:domain}},
 {site:0x008020,targets:[0x008030],source:'callbacks',resolution:{kind:'bytecode-callback-target-domain',complete:true},contexts:[{root:0x008014,targets:[0x008030],source:'cmd4',resolution:{kind:'bytecode-callback-target-domain-context',command:4,complete:true,target_hits:[{target:0x008030,hits:9,unique_sites:7}]}}]}
],limits:[]};
const post=['A=inputAccumulator*2','X=inputAccumulator*2','Y=currentSpriteBase','target=dispatchTable[inputAccumulator]'];
const proofs={schema:'forja65.handler-equivalence.v1',rom:hash,dispatcher_site:0x008007,proofs:[
 {target:0x008040,status:'dependency-boundary',scope:'dependency-abi',native_symbol:'fixture::depBoundary',span:{start:0x008040,end:0x008047},span_fingerprint:fp(0x008040,0x008047),evidence_spans:[{start:0x008047,end:0x00804D,fingerprint:fp(0x008047,0x00804D)}],contract:{postconditions:post},verification:{result:'PASS',cases:9,postconditions:post},dependencies:[]},
 {target:0x008030,status:'dependency-boundary',scope:'callback-abi',native_symbol:'fixture::callbackBoundary',span:{start:0x008030,end:0x008031},span_fingerprint:fp(0x008030,0x008031),verification:{result:'PASS',cases:9,external_dispatch:{dependency_entry:0x008040,routes:[{input:0,target:0x008050}]}},dependencies:[{target:0x008040,required_status:'dependency-boundary',required_postconditions:post}]}
]};
let plan=C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:proofs});
let cb=plan.callback_cutover,c=cb.callbacks.find(x=>x.target===0x008030);assert(c.native_body_ready);assert(!c.equivalence_proven);assert(c.dependency_boundary_ready);assert(c.proof.dependency_requirements_proven);assert(c.proof.dependencies_verified[0].verified);assert.equal(cb.semantic_callbacks_proven,0);assert.equal(cb.dependency_boundary_callbacks,1);assert.equal(cb.dependency_boundary_hits,9);assert.equal(cb.native_or_boundary_hits,9);assert(Math.abs(cb.native_or_boundary_fraction-1)<1e-12);
const cpp=C.nativeDispatchCpp(plan,{namespace:'fixture_generated'});assert(cpp.includes('dependency_boundary_ready'));
const missing=JSON.parse(JSON.stringify(proofs));missing.proofs=missing.proofs.filter(x=>x.target!==0x008040);plan=C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:missing});c=plan.callback_cutover.callbacks.find(x=>x.target===0x008030);assert(!c.native_body_ready);assert(!c.dependency_boundary_ready);assert.equal(plan.callback_cutover.dependency_boundary_hits,0);
const bad=JSON.parse(JSON.stringify(proofs));bad.proofs[0].verification.postconditions=['X=inputAccumulator*2'];assert.throws(()=>C.nativeDispatchPlan(rom,0x008007,pack,{handlerProofs:bad}),/postcondition mismatch/i);
console.log('external-dispatch-boundary-v0351-regression: OK');
