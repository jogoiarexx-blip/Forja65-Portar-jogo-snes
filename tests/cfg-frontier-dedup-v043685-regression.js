'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core');
const d=C.makeSyntheticRom();
// 48 conditional branches share the same successor, which remains pending
// while DFS follows each branch's fallthrough. The old CFG queued it 48 times.
const branches=48,target=branches*2+8;
for(let i=0;i<branches;i++){d[i*2]=0xd0;d[i*2+1]=target-(i*2+2);}
d[branches*2]=0xea;
d[target]=0xdb;
const a=C.analyze(C.loadRom(d),4096),f=a.functions.find(fn=>fn.start===0x8000);
assert(f,'missing CFG entry function');
assert.equal(f.frontierDiagnostics.duplicateEnqueuesAvoided,48);
assert.equal(f.frontierDiagnostics.peakPending,2);
assert.equal(f.instructions.filter(i=>i.pc===(0x8000+target)).length,1);
assert.equal(f.instructions.filter(i=>i.mnemonic==='BNE').length,branches);
assert.equal(f.edges.filter(e=>e.to===(0x8000+target)&&e.type==='branch-taken').length,branches);
assert(!f.issues.some(i=>i.kind==='CFG-LIMIT'),'duplicate frontier consumed instruction budget');
// A return site must still be marked when an earlier branch already queued it.
const rom2=C.makeSyntheticRom();rom2.set([0x20,0x10,0x80,0xdb],0);rom2[0x10]=0x60;
const f2=C.analyze(C.loadRom(rom2),512).functions.find(fn=>fn.start===0x8000);
assert(f2.instructions.some(i=>i.pc===0x8003&&i.returnSite),'return-site provenance lost');
console.log('CFG_FRONTIER_DEDUP_V043685_PASS duplicates=48 peak=2 branches='+branches);
