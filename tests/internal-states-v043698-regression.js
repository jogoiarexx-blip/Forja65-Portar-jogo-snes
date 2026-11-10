'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core'),R=require('../analysis/internal-replay');
function index(a){return new Map(a.functions.map(f=>[f.functionKey,new Map(f.instructions.map(i=>[i.stateKey,i.raw.join(',')+'|'+i.size]))]));}
// PHP saved M=0 survives SEP and the budget boundary; PLP is re-derived.
const b=C.makeSyntheticRom();b.set([0x18,0xfb,0xc2,0x30,0x08,0xe2,0x30,0xea,0x28,0xa9,0x34,0x12,0xdb]);const rom=C.loadRom(b),opts={globalCfg:false};
const first=C.analyze(rom,6,[],opts),next=C.analyze(rom,4,[],{...opts,internalCoverage:index(first),internalReplayBudget:8});
assert(next.instructions.some(i=>i.pc===0x8009&&i.mnemonic==='LDA'&&i.size===3&&i.stateIn.m8===false),'PHP/PLP stack state re-derived, never restored from cached state');
const full=C.analyze(rom,128,[],opts);for(const f of next.functions)for(const i of f.instructions){const known=full.functions.find(q=>q.functionKey===f.functionKey)?.instructions.find(q=>q.stateKey===i.stateKey);assert(known);assert.deepEqual(i.raw,known.raw);assert.deepEqual(i.stateOut,known.stateOut);}
// Arbitrary priorities cannot turn operand/data bytes into CFG nodes.
const bogus=new Map(first.functions.map(f=>[f.functionKey,new Set(['00800A|0000|S:','00DEAD|111Q|S:'])]));const attacked=C.analyze(rom,4,[],{...opts,internalCoverage:index(first),internalReplayBudget:8,focusFrontiers:bogus});assert.deepEqual(attacked.functions.flatMap(f=>f.instructions.map(i=>i.stateKey)),next.functions.flatMap(f=>f.instructions.map(i=>i.stateKey)));
// A wrong raw-byte comparison receives no replay credit.
const bad=index(first);for(const map of bad.values())for(const k of map.keys())map.set(k,'0|1');const wrong=C.analyze(rom,4,[],{...opts,internalCoverage:bad,internalReplayBudget:8});assert.equal(wrong.rieInternalReplay.replayed,0);assert(wrong.instructionVariants<=4);
const capped=C.analyze(rom,4,[],{...opts,internalCoverage:index(first),internalReplayBudget:1});assert.equal(capped.rieInternalReplay.replayed,1);assert(capped.instructionVariants<=5);
// Five CPU modes, an interbank JSL and an indirect pointer discovered after replay.
for(const state of [{emulation:true,m8:true,x8:true,carry:null},{emulation:false,m8:false,x8:false,carry:false},{emulation:false,m8:true,x8:false,carry:true},{emulation:false,m8:false,x8:true,carry:null},{emulation:false,m8:true,x8:true,carry:false}]){
 const data=C.makeSyntheticRom();data.set([0xdb]);data.set(state.x8?[0xa2,4,0x7c,0,0x90]:[0xa2,4,0,0x7c,0,0x90],0x100);data.set([0,0x83],0x1004);data[0x300]=0x6b;const rr=C.loadRom(data),options={globalCfg:false,discoverySeeds:[{start:0x018100,state}]},a=C.analyze(rr,2,[],options),expanded=C.analyze(rr,8,[],{...options,internalCoverage:index(a),internalReplayBudget:8});assert(expanded.functions.some(f=>f.start===0x018100));assert(expanded.functions.flatMap(f=>f.calls).some(c=>c.target===0x018300),'indirect pointer in PB re-derived after prefix replay');
}
const j=C.makeSyntheticRom();j.set([0x22,0,0x81,1,0xdb]);j.set([0xe2,0x30,0x6b],0x100);const jr=C.loadRom(j),a=C.analyze(jr,1,[],opts),z=C.analyze(jr,4,[],{...opts,internalCoverage:index(a),internalReplayBudget:8});assert(z.functions.some(f=>f.start===0x018100));assert(z.rieInternalReplay.passes.every(p=>p.replayed<=p.budget&&p.charged<=4));
// Import caps; invalid/missing contexts do not import scheduling credits.
const cache={schema:'forja65.cfg-coverage-cache.v1',rom:'r',version:'v',internalReplayContext:'c',functions:first.functions};assert.equal(R.prepare(cache,{rom:'r',version:'v',context:'changed'}).accepted,0);
const malformed=JSON.parse(JSON.stringify(cache));malformed.functions[0].instructions[0].stateKey='BAD';assert(R.prepare(malformed,{rom:'r',version:'v',context:'c'}).rejected>0);
console.log('INTERNAL_PHP_PLP_MODES_INTERBANK_INDIRECT_UNTRUSTED_PRIORITY_BUDGET_PASS');
const global=C.analyze(jr,2,[],{internalCoverage:index(a),internalReplayBudget:4,globalCfgRounds:1,globalCfgBudget:2});assert.equal(global.rieInternalReplay.runs.length,1+global.rieGlobal.expansionRounds,'account every global pass rather than losing replay work when merging');
