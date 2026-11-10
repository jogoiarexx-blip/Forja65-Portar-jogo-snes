'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom());
const files=F.generateProject(rom,F.analyze(rom,96));
const rt=files['src/runtime.hpp'];
assert(rt);
for(const key of ['writeControlPortFast(', 'FORJA65_PPU_FAST_CONTROL', 'const bool directControl=', 'ppu_control_fast_writes=', 'ppuControlFastWrites++'])
  assert(rt.includes(key),`Missing R15 control fastpath in generated runtime: ${key}`);
assert(rt.includes('else if(directControl){ppu.writeControlPortFast(lo,v);ppuControlFastWrites++;}'));
console.log('R15_CONTROL_GENERATOR_PASS');
