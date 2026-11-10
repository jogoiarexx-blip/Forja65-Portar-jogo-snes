const assert=require('node:assert/strict'),C=require('../forja65-core');const r=C.loadRom(C.makeSyntheticRom()),p=C.generateProject(r,C.analyze(r,128));
for(const name of ['hardware_color_hdma_v0392','sprite_planes_v0392'])assert.ok(p['tests/'+name+'.cpp'],'Every translated ROM needs '+name);
for(const name of ['hdma_bank_wrap','color_half_arithmetic','color_window_backdrop','obj_planes_equivalence'])assert.ok(p['CMakeLists.txt'].includes('add_test(NAME '+name),'Missing registered '+name);
console.log('Generic PPU/HDMA generated project tests: PASS');
