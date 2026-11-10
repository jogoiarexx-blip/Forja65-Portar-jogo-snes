'use strict';
const assert=require('assert'),C=require('../forja65-core.js');
const d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0);d.set([0x10,0x80,0x20,0x80,0x30,0x80],10);d.set([0x6C,0x42,0x00],16);d[32]=0x60;d[48]=0x60;
const rom=C.loadRom(d,'indirect-proof.sfc'),hash=C.romFingerprint(rom),fp=(a,b)=>C.fnv1a64Bytes(d.slice(a-0x8000,b-0x8000));
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},entries:[],dataRegions:[{start:0x800A,end:0x8010}],dispatch:[{site:0x8007,targets:[0x8010,0x8020,0x8030],resolution:{kind:'inline-structural-table',entries:3,script_domain:{complete:true,index_bounds_proven:true,observed_ids_in_closed_entries:[0,1,2],table_entries:3}}}],limits:[]};
const indirect=[{site:0x8010,targets:[0x8020,0x8030]}];
const p={target:0x8010,status:'equivalent',scope:'handler-abi',span:{start:0x8010,end:0x8013},span_fingerprint:fp(0x8010,0x8013),contract:{indirect_calls:indirect},verification:{result:'PASS',cases:4,indirect_calls:indirect},dependencies:[{target:0x8020},{target:0x8030}]};
const dep=t=>({target:t,status:'equivalent',scope:'dependency-abi',span:{start:t,end:t+1},span_fingerprint:fp(t,t+1),verification:{result:'PASS',cases:4},dependencies:[]});
const proofs={schema:'forja65.handler-equivalence.v1',rom:hash,dispatcher_site:0x8007,proofs:[p,dep(0x8020),dep(0x8030)]};
function plan(q,k=pack){return C.nativeDispatchPlan(rom,0x8007,k,{handlerProofs:q,maxPerTarget:128,handlerMax:32});}
let h=plan(proofs).handlers[0];assert(h.equivalence_proven);assert.strictEqual(h.proof.indirect_calls_verified,true);assert.strictEqual(h.translation_candidate,false,'static CFG remains distinct');assert.strictEqual(h.native_execution_ready,true);
const bad=JSON.parse(JSON.stringify(proofs));bad.proofs[0].verification.indirect_calls[0].targets=[0x8020];assert.throws(()=>plan(bad),/indirect-call proof domain mismatch/);
const incomplete=JSON.parse(JSON.stringify(proofs));incomplete.proofs[0].dependencies.pop();assert.throws(()=>plan(incomplete),/indirect-call dependency missing/);
const open=JSON.parse(JSON.stringify(proofs));open.proofs.pop();assert(!plan(open).handlers[0].equivalence_proven);
const dup=JSON.parse(JSON.stringify(proofs));dup.proofs.push(dep(0x8020));assert.throws(()=>plan(dup),/Duplicate handler proof/);
const stripped=JSON.parse(JSON.stringify(proofs));delete stripped.proofs[0].contract.indirect_calls;delete stripped.proofs[0].verification.indirect_calls;stripped.proofs[0].dependencies=[];stripped.proofs.splice(1);assert.throws(()=>plan(stripped),/indirect-call proof missing site/);
const known=JSON.parse(JSON.stringify(pack));known.dispatch.push({site:0x8010,targets:[0x8020,0x8030]});
const subset=JSON.parse(JSON.stringify(proofs));subset.proofs[0].contract.indirect_calls[0].targets=[0x8020];subset.proofs[0].verification.indirect_calls[0].targets=[0x8020];subset.proofs[0].dependencies.pop();subset.proofs.pop();assert.throws(()=>plan(subset,known),/indirect-call proof omits known target/);
const invalidRequirement=JSON.parse(JSON.stringify(proofs));invalidRequirement.proofs[0].dependencies[0].required_status='skip';assert.throws(()=>plan(invalidRequirement),/Unknown handler dependency requirement/);
// A dependency proof must declare its own indirect calls, even outside the
// dispatcher's handler list. Mutate the third leaf (non-dispatch target) to JMP.
const nestedData=new Uint8Array(d);nestedData.set([0x6C,0x42,0],0x40);
const nestedRom=C.loadRom(nestedData,'nested-proof.sfc'),nestedHash=C.romFingerprint(nestedRom);
const nestedPack=JSON.parse(JSON.stringify(pack));nestedPack.rom.fnv1a64=nestedHash;nestedPack.dispatch.push({site:0x8040,targets:[0x8030]});
const nestedProofs=JSON.parse(JSON.stringify(proofs));nestedProofs.rom=nestedHash;nestedProofs.proofs[0].dependencies.push({target:0x8040});nestedProofs.proofs.push({target:0x8040,status:'equivalent',scope:'dependency-abi',span:{start:0x8040,end:0x8043},span_fingerprint:C.fnv1a64Bytes(nestedData.slice(0x40,0x43)),verification:{result:'PASS',cases:4},dependencies:[]});
assert.throws(()=>C.nativeDispatchPlan(nestedRom,0x8007,nestedPack,{handlerProofs:nestedProofs,handlerMax:64}),/indirect-call proof missing site/);
const missingSharedDependency=JSON.parse(JSON.stringify(proofs));missingSharedDependency.proofs[1].contract={shared_state:['wram:$1234']};assert.throws(()=>plan(missingSharedDependency),/shared-state proof ABI mismatch/);
console.log('indirect-handler-proof-v0348-regression: OK');
const missingOriginalCases=JSON.parse(JSON.stringify(proofs));missingOriginalCases.proofs[0].verification.original_dependencies_executed=true;
assert.throws(()=>plan(missingOriginalCases),/original indirect.*coverage/i);
