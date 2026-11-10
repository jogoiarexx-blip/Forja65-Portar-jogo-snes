'use strict';
const assert=require('assert'),C=require('../forja65-core.js');
const d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0);d.set([0x10,0x80,0x20,0x80,0x30,0x80],10);d.set([0x6C,0x42,0],16);d[32]=0x60;d[48]=0x60;
const rom=C.loadRom(d,'subdomain.sfc'),hash=C.romFingerprint(rom),fp=(a,b)=>C.fnv1a64Bytes(d.slice(a-0x8000,b-0x8000));
const calls=[{site:0x8010,targets:[0x8020,0x8030]}],sub=[{site:0x8010,targets:[0x8020]}];
const knowledge={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},entries:[],dataRegions:[{start:0x800A,end:0x8010}],dispatch:[{site:0x8007,targets:[0x8010,0x8020,0x8030],resolution:{kind:'inline-structural-table',entries:3,script_domain:{complete:true,index_bounds_proven:true,observed_ids_in_closed_entries:[0,1,2],table_entries:3}}},{site:0x8010,targets:[0x8020,0x8030]}],limits:[]};
const dep={target:0x8020,status:'equivalent',scope:'dependency-abi',span:{start:0x8020,end:0x8021},span_fingerprint:fp(0x8020,0x8021),verification:{result:'PASS',cases:4},dependencies:[]};

const limited={target:0x8010,status:'equivalent',scope:'dependency-abi',span:{start:0x8010,end:0x8013},span_fingerprint:fp(0x8010,0x8013),contract:{input_values:[1,3],indirect_calls:sub},verification:{result:'PASS',cases:4,input_values:[1,3],original_dependencies_executed:true,indirect_calls:sub,target_cases:[{site:0x8010,target:0x8020,cases:4}],input_cases:4,input_target_cases:[{input:1,cases:2,targets:[{site:0x8010,target:0x8020,cases:2}]},{input:3,cases:2,targets:[{site:0x8010,target:0x8020,cases:2}]}]},dependencies:[{target:0x8020}]};
const caller={target:0x8030,status:'equivalent',scope:'handler-abi',span:{start:0x8030,end:0x8031},span_fingerprint:fp(0x8030,0x8031),verification:{result:'PASS',cases:4},dependencies:[{target:0x8010,required_input_values:[1]}]};
const proofs={schema:'forja65.handler-equivalence.v1',rom:hash,dispatcher_site:0x8007,proofs:[limited,dep,caller]};
const plan=p=>C.nativeDispatchPlan(rom,0x8007,knowledge,{handlerProofs:p,handlerMax:64});
const callerReady=p=>plan(p).handlers.find(h=>h.target===0x8030).equivalence_proven;
assert(callerReady(proofs));
function bad(edit,pattern){const q=structuredClone(proofs);edit(q);assert.throws(()=>plan(q),pattern);}
bad(q=>delete q.proofs[0].verification.input_target_cases,/omits known target/i);
bad(q=>q.proofs[0].verification.input_target_cases.pop(),/input case coverage/i);
bad(q=>q.proofs[0].verification.input_target_cases[1].targets[0].cases=1,/input target case coverage/i);
bad(q=>q.proofs[0].verification.input_target_cases[1].input=1,/input target evidence/i);
bad(q=>q.proofs[0].verification.input_target_cases[0].targets[0].target=0x8030,/input target domain/i);
bad(q=>q.proofs[0].verification.input_cases=3,/input case coverage/i);
bad(q=>q.proofs[0].scope='handler-abi',/input domain requires dependency/i);
const outside=structuredClone(proofs);outside.proofs[2].dependencies[0].required_input_values=[2];assert(!callerReady(outside));
const unknown=structuredClone(proofs);delete unknown.proofs[2].dependencies[0].required_input_values;assert(!callerReady(unknown));
console.log('bounded-input-indirect-domain-v0356-regression: OK');
