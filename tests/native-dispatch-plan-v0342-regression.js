'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');
let d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);
// REP #$30; AND #$0002; ASL; TAX; JMP ($800A,X)
d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0x0000);
d.set([0x10,0x80,0x14,0x80,0x18,0x80],0x000A);
d[0x0010]=0x60;d[0x0014]=0x60;d[0x0018]=0x60;
const rom=C.loadRom(d,'native-dispatch-plan.sfc'),hash=C.romFingerprint(rom);
const proof={kind:'bytecode-script-domain-audit',complete:true,index_bounds_proven:true,closed_entries:3,invalid_entries:0,observed_ids_in_closed_entries:[0,1,2],table_entries:3};
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{project:'fixture'},entries:[],dataRegions:[{start:0x00800A,end:0x008010,source:'fixture'}],dispatch:[{site:0x008007,targets:[0x008010,0x008014,0x008018],source:'fixture',resolution:{kind:'inline-structural-table',entries:3,script_domain:proof}}],limits:[]};
const plan=C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128,handlerMax:64});
assert.equal(plan.schema,'forja65.native-dispatch-plan.v1');
assert.equal(plan.table_entries,3);assert.equal(plan.unique_targets,3);assert.equal(plan.index_bounds_proven,true);
assert.deepEqual(plan.entries.map(x=>x.target),[0x008010,0x008014,0x008018]);
assert.deepEqual(plan.entries.map(x=>x.observed),[true,true,true]);
assert.equal(plan.handlers.length,3);assert(plan.handlers.every(h=>h.translation_candidate));assert(plan.handlers.every(h=>!h.equivalence_proven));
assert.equal(plan.cutover.route_generation_ready,true);assert.equal(plan.cutover.handler_execution_ready,false);
const cpp=C.nativeDispatchCpp(plan,{namespace:'fixture_generated'});
assert(cpp.includes('kDispatchEntries'));assert(cpp.includes('kDispatchHandlers'));assert(cpp.includes('0x008010u'));assert(cpp.includes('dispatchHandler'));
// Removing runtime-domain proof must refuse native route generation.
pack.dispatch[0].resolution.script_domain.complete=false;pack.dispatch[0].resolution.script_domain.index_bounds_proven=false;
assert.throws(()=>C.nativeDispatchPlan(rom,0x008007,pack,{maxPerTarget:128}),/index domain is not proven/);
console.log('native-dispatch-plan-v0342-regression: OK');
