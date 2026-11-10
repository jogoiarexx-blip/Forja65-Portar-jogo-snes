'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');
let d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);
// Main 3-entry dispatcher at $008007.
d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0x0000);
d.set([0x10,0x80,0x14,0x80,0x18,0x80],0x000A);
d[0x0010]=0x60;d[0x0014]=0x60;d[0x0018]=0x60;
// Three synthetic callback bodies.
d[0x0030]=0x60;d[0x0034]=0x60;d[0x0038]=0x60;
const rom=C.loadRom(d,'callback-family-equivalence.sfc'),hash=C.romFingerprint(rom);
const domain={kind:'bytecode-script-domain-audit',complete:true,index_bounds_proven:true,closed_entries:3,invalid_entries:0,observed_ids_in_closed_entries:[0,1,2],table_entries:3,command_hits:{'0':50,'1':25,'2':5}};
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{project:'fixture'},entries:[],dataRegions:[{start:0x00800A,end:0x008010,source:'fixture'}],dispatch:[
 {site:0x008007,targets:[0x008010,0x008014,0x008018],source:'fixture',resolution:{kind:'inline-structural-table',entries:3,script_domain:domain}},
 {site:0x008020,targets:[0x008030,0x008034,0x008038],source:'callback-fixture',resolution:{kind:'bytecode-callback-target-domain',complete:true,structural_hits:30,unique_targets:3},contexts:[
   {root:0x008010,targets:[0x008030,0x008034],source:'cmd3',resolution:{kind:'bytecode-callback-target-domain-context',command:3,complete:true,target_hits:[{target:0x008030,hits:10,unique_sites:7},{target:0x008034,hits:5,unique_sites:5}]}},
   {root:0x008014,targets:[0x008038],source:'cmd4',resolution:{kind:'bytecode-callback-target-domain-context',command:4,complete:true,target_hits:[{target:0x008038,hits:15,unique_sites:9}]}}
 ]}
],limits:[]};
function fp(start,end){const bytes=[];for(let a=start;a<end;a++)bytes.push(rom.data[C.snesToRom(rom,a)]);return C.fnv1a64Bytes(bytes);}
const proofs={schema:'forja65.handler-equivalence.v1',rom:hash,dispatcher_site:0x008007,proofs:[
 {target:0x008018,status:'equivalent',scope:'handler-abi',native_symbol:'fixture::handler2',span:{start:0x008018,end:0x008019},span_fingerprint:fp(0x008018,0x008019),verification:{result:'PASS',cases:5},dependencies:[]},
 {target:0x008030,status:'equivalent',scope:'callback-abi',native_symbol:'fixture::cb30',span:{start:0x008030,end:0x008031},span_fingerprint:fp(0x008030,0x008031),contract:{flow_outcomes:[0x008099],shared_state:[]},verification:{result:'PASS',cases:20,continuations:[0x008099],shared_state:[]},dependencies:[]},
 {target:0x008038,status:'equivalent',scope:'callback-abi',native_symbol:'fixture::cb38',span:{start:0x008038,end:0x008039},span_fingerprint:fp(0x008038,0x008039),contract:{flow_outcomes:[0x008099],shared_state:['wram:$1234']},verification:{result:'PASS',cases:30,continuations:[0x008099],shared_state:['wram:$1234']},dependencies:[]}
]};
const plan=C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64,handlerProofs:proofs});
const cb=plan.callback_cutover;
assert(cb.available);assert.equal(cb.total_callbacks,3);assert.equal(cb.semantic_callbacks_proven,2);
assert.equal(cb.total_hits,30);assert.equal(cb.native_hits,25);assert(Math.abs(cb.native_fraction-25/30)<1e-12);
assert.equal(cb.contexts.find(x=>x.command===3).native_hits,10);assert.equal(cb.contexts.find(x=>x.command===4).native_hits,15);
const c30=cb.callbacks.find(x=>x.target===0x008030),c34=cb.callbacks.find(x=>x.target===0x008034),c38=cb.callbacks.find(x=>x.target===0x008038);
assert(c30.equivalence_proven&&!c30.requires_shared_state);assert(!c34.equivalence_proven);assert(c38.equivalence_proven&&c38.requires_shared_state);
const cov=plan.cutover.structural_script_hit_coverage;assert.equal(cov.native_hits,5);assert.equal(cov.native_plus_callback_hits,30);assert.equal(cov.total_hits,80);
const cpp=C.nativeDispatchCpp(plan,{namespace:'fixture_generated'});assert(cpp.includes('NativeCallbackStatus'));assert(cpp.includes('kNativeCallbacks'));assert(cpp.includes('nativeCallback(std::uint32_t target)'));
const bad=JSON.parse(JSON.stringify(proofs));bad.proofs.find(x=>x.target===0x008030).verification.continuations=[0x008098];
assert.throws(()=>C.nativeDispatchPlan(rom,0x008007,pack,{handlerProofs:bad}),/continuation mismatch/);
console.log('callback-family-equivalence-v0349-regression: OK');
