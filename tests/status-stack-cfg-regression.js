'use strict';
const assert=require('assert'),C=require('../forja65-core');
const rom=C.loadRom(C.makeSyntheticRom()),base=C.resetAddress(rom),off=C.snesToRom(rom,base);
// Native M=8/X=16 caller; callee temporarily widens A then restores status.
rom.data.set([0x18,0xfb,0xc2,0x10,0x20,0x20,0x80,0xa9,0x42,0x85,0x10,0xdb],off);
rom.data.set([0x08,0xc2,0x20,0x48,0x68,0x28,0x60],off+0x20);
let a=C.analyze(rom,512),after=a.functions.flatMap(f=>f.instructions).filter(i=>i.pc===base+7);
assert(after.some(i=>i.stateIn.m8&&!i.stateIn.x8&&i.size===2),'balanced PHP/PLP must restore M/X at caller');
assert(!after.some(i=>!i.stateIn.m8),'false wide return decodes operand as code');
// PLP does not restore E; emulate forced widths, balanced nested status saves.
rom.data.set([0x08,0xc2,0x20,0x08,0xe2,0x20,0x28,0x28,0x60],off+0x20);
a=C.analyze(rom,512);after=a.functions.flatMap(f=>f.instructions).filter(i=>i.pc===base+7);
assert(after.some(i=>i.stateIn.m8&&!i.stateIn.x8),'nested saves must restore outer status');
console.log('status-stack-cfg-regression: OK');
