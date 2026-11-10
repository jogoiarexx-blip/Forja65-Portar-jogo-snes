'use strict';
const assert=require('assert'),C=require('../forja65-core.js');
const d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);d.set([0xC2,0x30,0x29,0x7F,0,0x0A,0xAA,0x7C,0x0A,0x80],0);d.set([0x10,0x80,0x20,0x80,0x30,0x80],10);
for(const off of [16,32,48,80,96])d[off]=0x60;d.set([0x6C,0x42,0],64);d.set([0x6C,0x42,0],16);
const rom=C.loadRom(d,'guarded.sfc'),hash=C.romFingerprint(rom),fp=(a,b)=>C.fnv1a64Bytes(d.slice(a-0x8000,b-0x8000));
const knowledge={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},entries:[],dataRegions:[{start:0x800A,end:0x8010}],dispatch:[{site:0x8007,targets:[0x8010,0x8020,0x8030],resolution:{kind:'inline-structural-table',entries:3,script_domain:{complete:true,index_bounds_proven:true,observed_ids_in_closed_entries:[0,1,2],table_entries:3}}},{site:0x8040,targets:[0x8050,0x8060]},{site:0x8010,targets:[0x8040]}],limits:[]};
const guards=['state:normal','budget:bounded'],calls=[{site:0x8040,targets:[0x8050]}],witness=[{site:0x8040,target:0x8050,cases:4}];
const dep={target:0x8040,status:'equivalent',scope:'dependency-abi',span:{start:0x8040,end:0x8043},span_fingerprint:fp(0x8040,0x8043),evidence_spans:[{start:0x8050,end:0x8051,fingerprint:fp(0x8050,0x8051)}],contract:{runtime_guards:guards,indirect_calls:calls,inlined_indirect_targets:[0x8050]},verification:{result:'PASS',cases:4,original_dependencies_executed:true,indirect_calls:calls,target_cases:witness,guarded_indirect_calls:witness,runtime_guards:guards,guard_cases:guards.map(guard=>({guard,cases:1})),rejected_cases:2,rejected_state_unchanged:true,accepted_instruction_cases:[{pc:0x8040,cases:4},{pc:0x8050,cases:4}]},dependencies:[]};
const caller={target:0x8010,status:'equivalent',scope:'handler-abi',span:{start:0x8010,end:0x8013},span_fingerprint:fp(0x8010,0x8013),contract:{indirect_calls:[{site:0x8010,targets:[0x8040]}]},verification:{result:'PASS',cases:4,indirect_calls:[{site:0x8010,targets:[0x8040]}]},dependencies:[{target:0x8040}]};
const pack={schema:'forja65.handler-equivalence.v1',rom:hash,dispatcher_site:0x8007,proofs:[caller,dep]},run=p=>C.nativeDispatchPlan(rom,0x8007,knowledge,{handlerProofs:p,handlerMax:64});
assert.strictEqual(run(pack).handlers.find(h=>h.target===0x8010).equivalence_proven,false,'guarded dependency cannot authorize entire handler');
const claiming=structuredClone(pack);claiming.proofs[0].dependencies[0].required_runtime_guards=guards;
assert.strictEqual(run(claiming).handlers.find(h=>h.target===0x8010).native_execution_ready,false,'caller requirement alone cannot prove unrestricted handler');
const conditional=structuredClone(pack);
const c=conditional.proofs[0];c.status='dependency-boundary';c.span.end=0x8013;c.span_fingerprint=fp(0x8010,0x8013);c.contract={indirect_calls:[{site:0x8010,targets:[0x8040]}]};c.verification.indirect_calls=c.contract.indirect_calls;
c.specializations=[{key:'guarded',contract:{indirect_calls:c.contract.indirect_calls,flow_outcomes:[0x8020]},verification:{result:'PASS',original_dependencies_executed:true,cases:4,indirect_calls:c.contract.indirect_calls,continuations:[0x8020],target_cases:[{site:0x8010,target:0x8040,cases:4}]},dependencies:[{target:0x8040,required_runtime_guards:guards}]}];
const h=run(conditional).handlers.find(h=>h.target===0x8010);assert(h.conditional_execution_ready&&!h.native_execution_ready);
const omitted=structuredClone(conditional);delete omitted.proofs[0].specializations[0].dependencies[0].required_runtime_guards;assert(!run(omitted).handlers.find(h=>h.target===0x8010).conditional_execution_ready);
function bad(edit,pattern){const p=structuredClone(conditional);edit(p.proofs[1]);assert.throws(()=>run(p),pattern||/guarded|indirect|inline/i);}
bad(p=>delete p.verification.guarded_indirect_calls);bad(p=>p.verification.rejected_state_unchanged=false);bad(p=>p.verification.guard_cases.pop());bad(p=>p.verification.guarded_indirect_calls[0].cases=5);bad(p=>p.verification.accepted_instruction_cases.pop());bad(p=>p.evidence_spans=[]);bad(p=>p.contract.inlined_indirect_targets=[0x8060]);bad(p=>p.scope='handler-abi');bad(p=>p.contract.runtime_guards=[]);
// A verified boundary cannot hide a guarded prerequisite from its caller.
const bridge=structuredClone(pack);bridge.proofs[0]={target:0x8020,status:'equivalent',scope:'handler-abi',span:{start:0x8020,end:0x8021},span_fingerprint:fp(0x8020,0x8021),verification:{result:'PASS',cases:4},dependencies:[{target:0x8060,required_status:'dependency-boundary'}]};
bridge.proofs.push({target:0x8060,status:'dependency-boundary',scope:'dependency-abi',span:{start:0x8060,end:0x8061},span_fingerprint:fp(0x8060,0x8061),verification:{result:'PASS',cases:4},dependencies:[{target:0x8040}]});
assert(!run(bridge).handlers.find(h=>h.target===0x8020).native_execution_ready,'boundary must not conceal guarded prerequisite');
bridge.proofs[2].dependencies[0].required_runtime_guards=guards;
assert(!run(bridge).handlers.find(h=>h.target===0x8020).native_execution_ready,'boundary guard declaration still cannot prove unrestricted handler');
const downgrade=structuredClone(conditional);downgrade.proofs[1]={target:0x8040,status:'dependency-boundary',scope:'dependency-abi',span:{start:0x8040,end:0x8043},span_fingerprint:fp(0x8040,0x8043),verification:{result:'PASS',cases:4},dependencies:[]};
assert(!run(downgrade).handlers.find(h=>h.target===0x8010).conditional_execution_ready,'specializations require equivalent bodies, not boundaries');

console.log('guarded-inline-domain-v0360-regression: OK');
