'use strict';
const assert = require('node:assert/strict');
const F = require('../forja65-core.js');
const rom = F.loadRom(F.makeSyntheticRom());
const files = F.generateProject(rom,F.analyze(rom,96));
const runtime = files['src/runtime.hpp'];
assert(runtime, 'generated runtime exists');
for(const text of ['void writeAddressPortFast(', 'void writeWindowDataFast(', 'FORJA65_PPU_FAST_ADDRESS', 'FORJA65_PPU_FAST_WINDOW', 'FORJA65_PPU_WINDOW_DEDUP', 'ppu_window_fast_writes=', 'forja65-ppu-path-profile.csv']) {
 assert(runtime.includes(text), 'missing in generated runtime: '+text);
}
assert(runtime.includes('ppu.wh[lo-0x2126u]==v'), 'must guard redundant raster sync by current latch value');
console.log('R13_GENERATED_PPU_WINDOW_FASTPATH_PASS');
