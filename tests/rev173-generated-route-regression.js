'use strict';
const assert = require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../forja65-core.js');
const loaded=core.loadRom(core.makeSyntheticRom());
const files=core.generateProject(loaded,core.analyze(loaded,128));
for(const f of ['tools/branch-route-search-rev173.py','tests/test_branch_route_rev173.py','tests/cpu_ppu_ports_rev173.cpp']){
  assert.equal(files[f],fs.readFileSync(path.join(__dirname,'..',f),'utf8'),`generated ${f} diverged from source`);
}
assert.match(files['CMakeLists.txt'],/add_test\(NAME cpu_ppu_ports_rev173/);
assert.match(files['CMakeLists.txt'],/target_include_directories\(cpu_ppu_ports_rev173 PRIVATE src\)/);
assert.match(files['tools/branch-route-search-rev173.py'],/phase_cleared.*NOT_VERIFIED/);
console.log('REV173 generator: route search + CPU/PPU regression emitted successfully');
