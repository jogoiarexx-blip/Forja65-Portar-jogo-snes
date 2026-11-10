'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core');
function vectorRom(){const b=C.makeSyntheticRom();b[0]=0xdb;for(const at of [0x7fe4,0x7fe6,0x7fe8,0x7ff4,0x7ff8]){b[at]=0x00;b[at+1]=0x81;}b.set([0x22,0x00,0x82,0x00,0x40],0x100);b[0x200]=0x6b;return C.loadRom(b);}
const r=vectorRom(),a=C.analyze(r,2048),old=C.analyze(r,2048,[],{globalCfg:false});
assert(a.functions.some(f=>f.start===0x8100),'COP/BRK/ABORT static vector handler must be discovered without execution');assert(!old.functions.some(f=>f.start===0x8100));
assert(a.rieGlobal.roots.some(x=>x.vector===0xffe4));assert.equal(a.rieGlobal.roots.filter(x=>x.start===0x8100).length,5,'dedup native 4 widths plus emulation');
assert(a.functions.some(f=>f.start===0x8200));for(const f of a.functions.filter(f=>f.start===0x8100&&f.entryState.emulation))assert(f.entryState.m8&&f.entryState.x8);
const guarded=C.analyze(r,2048,[],{knowledge:{schema:'forja65.knowledge.v1',dataRegions:[{start:0x8100,end:0x8104}],entries:[]}});assert(!guarded.rieGlobal.roots.some(x=>x.start===0x8100));
function chain(){const b=new Uint8Array(0x10000);b.set(C.makeSyntheticRom());b.fill(0,0x8000);b.set([0x22,0x00,0x80,0x81,0xdb]);for(let n=0;n<16;n++){const off=0x8000+n*16;if(n<15)b.set([0x22,(off+16)&255,((off+16)>>>8)&255,0x81,0x6b],off);else b[off]=0x6b;}return C.loadRom(b);}
const cr=chain(),first=C.analyze(cr,8,[],{globalCfgRounds:0}),expanded=C.analyze(cr,8,[],{globalCfgRounds:1,globalCfgBudget:64,globalCfgCeiling:200});
assert(first.cfgFrontier.some(x=>x.from!==undefined&&x.start>=0x818010),'pending calls must survive the analysis budget');assert(expanded.decoded>first.decoded,'extra bounded round must discover more code before execution');
const before=new Set(first.functions.flatMap(f=>f.instructions.map(i=>i.pc+'|'+i.stateSig)));const after=new Set(expanded.functions.flatMap(f=>f.instructions.map(i=>i.pc+'|'+i.stateSig)));for(const k of before)assert(after.has(k),'expansion must preserve prior coverage');
assert(expanded.rieGlobal.addedInstructions>0);assert(expanded.rieGlobal.expansionRounds<=1);assert(expanded.rieGlobal.executedEvidence===false);
assert.equal(C.analyze(cr,8,[],{globalCfgRounds:1,globalCfgBudget:64,globalCfgCeiling:1}).rieGlobal.expansionRounds,0);
const stackBytes=C.makeSyntheticRom();stackBytes.set([0x18,0xfb,0x08,0x22,0x20,0x80,0x00,0x80,0x17]);stackBytes.set([0x28,0xa9,0x11,0xdb,0xdb],0x20);const stackRom=C.loadRom(stackBytes),stackBase=C.analyze(stackRom,8);
assert(stackBase.cfgFrontier.some(q=>q.start===0x8020),'an internal label with a saved abstract PHP stack is not a fully analyzed call entry');
const stackExpanded=C.analyze(stackRom,8,[],{globalCfgRounds:1,globalCfgBudget:64});assert(stackExpanded.functions.some(f=>f.start===0x8020&&f.instructions.some(i=>i.pc===0x8021&&!i.stateIn.m8&&i.size===3)),'new call entry must reuse unknown-PLP width propagation, not borrow caller stack assumptions');
const files=C.generateProject(cr,expanded);assert(files['analysis/cfg-global.json']);assert(files['src/dispatch.cpp'].includes('818010'));
console.log('CFG_GLOBAL_V043695_PASS');
const slow=C.makeSyntheticRom();slow.fill(0xea,0,80);slow[80]=0xdb;for(const at of [0x7fe4,0x7fe6,0x7fe8,0x7ff4,0x7ff8]){slow[at]=0;slow[at+1]=0x81;}slow[0x100]=0x40;const slowRom=C.loadRom(slow),slowBase=C.analyze(slowRom,8),slowMore=C.analyze(slowRom,8,[],{globalCfgRounds:1,globalCfgBudget:64});assert(slowBase.rieGlobal.pendingVectorRoots.length);assert(slowMore.functions.some(f=>f.start===0x8100),'bounded extra pass must resume pending hardware vectors even without pending calls');
const fs=require('node:fs'),vm=require('node:vm'),context={console,Uint8Array,TextEncoder,TextDecoder};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../forja65-core'),'utf8'),context);const browser=context.Forja65Core;assert(browser,'browser exports must exist');const vmResult=browser.analyze(browser.loadRom(new Uint8Array(slow)),8,[],{globalCfgRounds:1,globalCfgBudget:64});assert.equal(vmResult.decoded,slowMore.decoded);assert.equal(vmResult.rieGlobal.expansionRounds,slowMore.rieGlobal.expansionRounds);
console.log('CFG_GLOBAL_VECTORS_AND_VM_PASS');

const aliasGuard=C.analyze(r,64,[],{knowledge:{schema:'forja65.knowledge.v1',entries:[],dataRegions:[{start:0x808000,end:0x818100}]}});assert(!aliasGuard.rieGlobal.roots.some(q=>q.start===0x8100),'cross-bank data region must protect physical mirrors');
const odd=new Uint8Array(0x18000);odd.set(r.data);const oddRom=C.loadRom(odd);const oddGuard=C.analyze(oddRom,64,[],{knowledge:{schema:'forja65.knowledge.v1',entries:[],dataRegions:[{start:0x808000,end:0x838100}]}});assert(!oddGuard.rieGlobal.roots.some(q=>q.start===0x8100),'non-power-of-two mirrors must preserve data exclusions');
console.log('CFG_GLOBAL_DATA_ALIAS_PASS');
