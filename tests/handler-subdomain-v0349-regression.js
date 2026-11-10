'use strict';
const assert=require('assert'),C=require('../forja65-core.js');
const d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0);d.set([0x10,0x80,0x20,0x80,0x30,0x80],10);d.set([0x6C,0x42,0],16);d[32]=0x60;d[48]=0x60;
const rom=C.loadRom(d,'subdomain.sfc'),hash=C.romFingerprint(rom),fp=(a,b)=>C.fnv1a64Bytes(d.slice(a-0x8000,b-0x8000));
const calls=[{site:0x8010,targets:[0x8020,0x8030]}],sub=[{site:0x8010,targets:[0x8020]}];
const knowledge={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},entries:[],dataRegions:[{start:0x800A,end:0x8010}],dispatch:[{site:0x8007,targets:[0x8010,0x8020,0x8030],resolution:{kind:'inline-structural-table',entries:3,script_domain:{complete:true,index_bounds_proven:true,observed_ids_in_closed_entries:[0,1,2],table_entries:3}}},{site:0x8010,targets:[0x8020,0x8030]}],limits:[]};
const dep={target:0x8020,status:'equivalent',scope:'dependency-abi',span:{start:0x8020,end:0x8021},span_fingerprint:fp(0x8020,0x8021),verification:{result:'PASS',cases:4},dependencies:[]};
const specialization={key:'original-leaf',native_symbol:'nativeOriginal',contract:{indirect_calls:sub,flow_outcomes:[0x8040],shared_state:['wram:$1000']},verification:{result:'PASS',cases:4,original_dependencies_executed:true,indirect_calls:sub,continuations:[0x8040],shared_state:['wram:$1000'],target_cases:[{site:0x8010,target:0x8020,cases:4}]},dependencies:[{target:0x8020}]};
const p={target:0x8010,status:'dependency-boundary',scope:'handler-abi',span:{start:0x8010,end:0x8013},span_fingerprint:fp(0x8010,0x8013),contract:{indirect_calls:calls},verification:{result:'PASS',cases:4,indirect_calls:calls},dependencies:[{target:0x8020},{target:0x8030}],specializations:[specialization]};
const proofs={schema:'forja65.handler-equivalence.v1',rom:hash,dispatcher_site:0x8007,proofs:[p,dep]};
const plan=q=>C.nativeDispatchPlan(rom,0x8007,knowledge,{handlerProofs:q,handlerMax:64});
assert.strictEqual(plan(proofs).cutover.partial_handler_execution_ready,true);
const h=plan(proofs).handlers[0];assert.strictEqual(h.equivalence_proven,false);assert.strictEqual(h.native_execution_ready,false);assert.strictEqual(h.conditional_execution_ready,true);assert.deepStrictEqual(h.authorized_subdomains[0].indirect_calls,sub);assert(C.nativeDispatchCpp(plan(proofs)).includes('nativeIndirectTargetAllowed'));
function bad(edit,pattern){const q=JSON.parse(JSON.stringify(proofs));edit(q);assert.throws(()=>plan(q),pattern);}
bad(q=>q.proofs[0].specializations[0].verification.indirect_calls[0].targets=[0x8030],/specialization.*domain/i);
bad(q=>q.proofs[0].specializations[0].verification.target_cases=[],/specialization.*case/i);
bad(q=>q.proofs[0].specializations[0].verification.original_dependencies_executed=false,/specialization.*original/i);
bad(q=>q.proofs[0].specializations[0].dependencies=[],/specialization.*dependency/i);
bad(q=>q.proofs[0].specializations[0].contract.indirect_calls[0].targets=[0x8040],/specialization.*domain/i);
bad(q=>q.proofs[0].specializations.push(structuredClone(q.proofs[0].specializations[0])),/duplicate.*specialization/i);
bad(q=>q.proofs[0].span_fingerprint='1234567890abcdef',/fingerprint/i);
bad(q=>q.proofs[0].specializations[0].verification.shared_state=[],/specialization.*shared/i);
bad(q=>q.proofs[0].specializations[0].verification.continuations=[],/specialization.*continuation/i);
bad(q=>{const duplicate=structuredClone(q.proofs[0].specializations[0]);duplicate.key='duplicate-target';q.proofs[0].specializations.push(duplicate);},/duplicate.*specialization/i);
bad(q=>q.proofs[0].dependencies.push({target:0x8050,required_status:'equivalent'}),/specialization.*common dependency/i);
const missingCommon=JSON.parse(JSON.stringify(proofs));missingCommon.proofs[0].dependencies.push({target:0x8050});missingCommon.proofs[0].specializations[0].dependencies.push({target:0x8050});assert.strictEqual(plan(missingCommon).handlers[0].conditional_execution_ready,false);
const multi=JSON.parse(JSON.stringify(proofs));multi.proofs[0].contract.indirect_calls.push({site:0x8011,targets:[0x8020]});multi.proofs[0].verification.indirect_calls.push({site:0x8011,targets:[0x8020]});multi.proofs[0].specializations[0].contract.indirect_calls.push({site:0x8011,targets:[0x8020]});multi.proofs[0].specializations[0].verification.indirect_calls.push({site:0x8011,targets:[0x8020]});assert.throws(()=>plan(multi),/exactly one indirect site/);
const missing=structuredClone(proofs);missing.proofs.pop();assert.strictEqual(plan(missing).handlers[0].conditional_execution_ready,false);
console.log('handler-subdomain-v0349-regression: OK');

const A=require('../analysis/native-map.js');assert.deepStrictEqual(A.normalizeKnowledgePack(knowledge,hash).dispatch[0].resolution,knowledge.dispatch[0].resolution);

// A guarded domain must require the same callee outputs as a whole handler.
const unsupportedPost=structuredClone(proofs);
unsupportedPost.proofs[0].specializations[0].dependencies[0].required_postconditions=['impossible-unproven-output'];
assert.strictEqual(plan(unsupportedPost).handlers[0].conditional_execution_ready,false);
const supportedPost=structuredClone(unsupportedPost);
supportedPost.proofs[1].contract={postconditions:['impossible-unproven-output']};
supportedPost.proofs[1].verification.postconditions=['impossible-unproven-output'];
assert.strictEqual(plan(supportedPost).handlers[0].conditional_execution_ready,true);
const weakenedCommon=structuredClone(proofs);
weakenedCommon.proofs[0].dependencies.push({target:0x8050,required_postconditions:['Y=currentSpriteBase']});
weakenedCommon.proofs[0].specializations[0].dependencies.push({target:0x8050});
assert.throws(()=>plan(weakenedCommon),/common dependency.*requirement/i);
// A target specialization does not narrow a common callee's input contract.
const commonInputs=structuredClone(proofs);
commonInputs.proofs[0].dependencies.push({target:0x8050,required_input_values:[1,2]});
commonInputs.proofs[0].specializations[0].dependencies.push({target:0x8050,required_input_values:[1]});
commonInputs.proofs.push({target:0x8050,status:'equivalent',scope:'dependency-abi',span:{start:0x8050,end:0x8051},span_fingerprint:fp(0x8050,0x8051),contract:{input_values:[1]},verification:{result:'PASS',cases:4,input_values:[1]},dependencies:[]});
assert.throws(()=>plan(commonInputs),/common dependency input domain weakened/i);
const unselectedInputs=structuredClone(proofs);unselectedInputs.proofs[0].dependencies[1].required_input_values=[3];
assert.equal(plan(unselectedInputs).handlers[0].conditional_execution_ready,true);
