'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core');
// Giving already covered observations the same priority as a pending crash
// starves its newly discovered callees under a bounded analysis budget.
const bytes=C.makeSyntheticRom();bytes[0]=0xDB;
bytes.set([0x22,0x40,0x82,0,0x6B],0x200);
bytes.set([0x22,0x60,0x82,0,0x6B],0x240);
bytes.set([0xA9,0x23,0x01,0x6B],0x260);
bytes.fill(0xEA,0x1000,0x1800);bytes[0x1800]=0xDB;
const rom=C.loadRom(bytes,'pending-dependencies.sfc');
const hs=C.parseRuntimeHints('target=009000 kind=FLOW e=0 m=0 x=0 c=0\ntarget=008200 kind=FLOW e=0 m=0 x=0 c=0');
for(const h of hs)h.cachedCoverage=h.target===0x9000;
const result=C.analyze(rom,128,hs);
assert(result.functions.some(f=>f.start===0x8260),'pending observed entry must discover its transitive calls before covered observations consume the budget');
console.log('PENDING_HINT_DEPENDENCIES_PASS');
