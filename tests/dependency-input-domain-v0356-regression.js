'use strict';
const assert=require('assert');const C=require('../forja65-core.js');
let d=C.makeSyntheticRom();d.fill(0xEA,0,0x300);
d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0);
d.set([0x10,0x80,0x14,0x80,0x18,0x80],0x0A);d[0x10]=0x60;d[0x14]=0x60;d[0x18]=0x60;
d[0x30]=0x60;d.set([0xA4,0x70,0x0A,0xAA,0x7C,0x47,0x80],0x40);d.set([0x50,0x80,0x54,0x80,0x58,0x80],0x47);d[0x50]=0x60;d[0x54]=0x60;d[0x58]=0x60;
const rom=C.loadRom(d,'leaf-cutover.sfc'),hash=C.romFingerprint(rom);const fp=(a,b)=>{const x=[];for(let p=a;p<b;p++)x.push(rom.data[C.snesToRom(rom,p)]);return C.fnv1a64Bytes(x);};
const domain={kind:'bytecode-script-domain-audit',complete:true,index_bounds_proven:true,closed_entries:3,invalid_entries:0,observed_ids_in_closed_entries:[0,1,2],table_entries:3,command_hits:{'0':10,'1':10,'2':10}};
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},entries:[],dataRegions:[{start:0x00800A,end:0x008010,source:'fixture'}],dispatch:[
 {site:0x008007,targets:[0x008010,0x008014,0x008018],source:'fixture',resolution:{kind:'inline-structural-table',entries:3,script_domain:domain}},
 {site:0x008020,targets:[0x008030],source:'callbacks',resolution:{kind:'bytecode-callback-target-domain',complete:true},contexts:[{root:0x008014,targets:[0x008030],source:'cmd4',resolution:{kind:'bytecode-callback-target-domain-context',command:4,complete:true,target_hits:[{target:0x008030,hits:9,unique_sites:7}]}}]}
],limits:[]};
const post=['A=inputAccumulator*2','X=inputAccumulator*2','Y=currentSpriteBase','target=dispatchTable[inputAccumulator]'];
const proofs={schema:'forja65.handler-equivalence.v1',rom:hash,dispatcher_site:0x008007,external_leaf_ranking:[{rank:1,callback_target:0x008030,accumulator:0,leaf_target:0x008050,structural_hits:9,unique_sites:7,family:'fixture-inc'}],proofs:[
 {target:0x008040,status:'dependency-boundary',scope:'dependency-abi',span:{start:0x008040,end:0x008047},span_fingerprint:fp(0x008040,0x008047),evidence_spans:[{start:0x008047,end:0x00804D,fingerprint:fp(0x008047,0x00804D)}],contract:{postconditions:post},verification:{result:'PASS',postconditions:post},dependencies:[]},
 {target:0x008030,status:'dependency-boundary',scope:'callback-abi',span:{start:0x008030,end:0x008031},span_fingerprint:fp(0x008030,0x008031),verification:{result:'PASS',external_dispatch:{dependency_entry:0x008040,routes:[{input:0,target:0x008050}]}},dependencies:[{target:0x008040,required_status:'dependency-boundary',required_postconditions:post}]},
 {target:0x008050,status:'equivalent',scope:'external-leaf-abi',native_symbol:'fixture::leaf',span:{start:0x008050,end:0x008051},span_fingerprint:fp(0x008050,0x008051),contract:{shared_state:[]},verification:{result:'PASS',callback_target:0x008030,accumulator:0,structural_hits:9,shared_state:[],family:'fixture-inc'},dependencies:[]}
]};

const leaf=proofs.proofs[2];leaf.dependencies=[{target:0x008060}];
proofs.proofs.push({target:0x008060,status:'equivalent',scope:'dependency-abi',span:{start:0x008060,end:0x008061},span_fingerprint:fp(0x008060,0x008061),contract:{input_values:[1,3]},verification:{result:'PASS',input_values:[1,3],cases:8},dependencies:[]});
const plan=p=>C.nativeDispatchPlan(rom,0x008007,pack,{handlerProofs:p,maxPerTarget:128,handlerMax:64});
assert.equal(plan(proofs).external_leaf_cutover.native_hits,0,'A caller with unspecified inputs must not use a bounded callee');
leaf.dependencies[0].required_input_values=[1];
assert.equal(plan(proofs).external_leaf_cutover.native_hits,9);
leaf.dependencies[0].required_input_values=[1,2];
assert.equal(plan(proofs).external_leaf_cutover.native_hits,0);
leaf.dependencies[0].required_input_values=[];
assert.equal(plan(proofs).external_leaf_cutover.native_hits,0);
leaf.dependencies[0].required_input_values=[3,1];
assert.equal(plan(proofs).external_leaf_cutover.native_hits,9);
const bad=structuredClone(proofs);bad.proofs[3].verification.input_values=[1];
assert.throws(()=>plan(bad),/input.*oracle.*mismatch/i);
for(const malformed of [[-1],[65536],[true],[1,1],['1']]){
 const bad=structuredClone(proofs);bad.proofs[2].dependencies[0].required_input_values=malformed;
 assert.throws(()=>plan(bad),/input.*domain/i);
}
console.log('dependency-input-domain-v0356-regression: OK');
