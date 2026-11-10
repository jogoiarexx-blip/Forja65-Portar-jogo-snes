'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom());
const files=F.generateProject(rom,F.analyze(rom,96));
const rt=files['src/runtime.hpp'];
assert(rt);
for(const key of ['writeScrollPortFast(', 'FORJA65_PPU_FAST_SCROLL', 'const bool directScroll=', 'ppu_scroll_fast_writes=', 'r14_scroll_fast_writes'])
  assert(rt.includes(key),`Missing R14 scroll fastpath in generated port: ${key}`);
assert(rt.includes('else if(directScroll){ppu.writeScrollPortFast(lo,v);ppuScrollFastWrites++;}'));
console.log('R14_SCROLL_GENERATOR_PASS');
