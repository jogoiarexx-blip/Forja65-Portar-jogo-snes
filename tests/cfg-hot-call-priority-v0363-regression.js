'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core');
const romBytes=F.makeSyntheticRom();
// Reset: JSR $8020; RTS. The NMI vector has four decoding-state variants.
// With a budget of four, all four must not preempt the known direct callee.
romBytes.set([0x20,0x20,0x80,0x60],0);
romBytes.set([0xe8,0x60],0x20);
romBytes[0x7fc0+0x2a]=0x30;romBytes[0x7fc0+0x2b]=0x80;
romBytes[0x30]=0x40; // RTI
const rom=F.loadRom(romBytes,'hot-call.sfc');
const a=F.analyze(rom,4);
assert.equal(a.functions[0].start,0x8000,'RESET remains the first entry');
assert.equal(a.functions[1].start,0x8020,'direct JSR must preempt unrelated vector variants');
assert(a.functions.some(f=>f.start===0x8020&&f.instructions.some(i=>i.mnemonic==='INX')),'callee instruction missing');
const ample=F.analyze(rom,64);
assert(ample.functions.some(f=>f.start===0x8030),'NMI vector must still be visited when budget permits');
assert(ample.functions.some(f=>f.start===0x8020),'direct callee lost when budget enlarged');
console.log('CFG_HOT_CALL_PRIORITY_V0363_PASS',{tightBudget:a.functions.map(f=>f.start.toString(16)),ampleBudget:ample.functions.length});
