'use strict';
// Compile and execute the PPU implementation emitted by Forja65, not a copy
// from a previously generated DKC3 port.
const fs=require('node:fs'),path=require('node:path');
require('./fixtures/run_spc_probe_v0431')('ppu-offset-per-tile-v04364',
 fs.readFileSync(path.join(__dirname,'fixtures/ppu_offset_per_tile_v04364.cpp'),'utf8'));
