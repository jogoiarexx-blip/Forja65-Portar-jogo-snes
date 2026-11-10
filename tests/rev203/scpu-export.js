const assert=require('assert'),C=require('../../forja65-core');
const r=C.loadRom(C.makeSyntheticRom()),a=C.analyze(r,128);
for(const cpuInterpreter of [true,false]){const f=C.generateProject(r,a,{cpuInterpreter});assert(f['src/forja_scpu_aot.hpp']);assert(f['src/main.cpp'].includes('forja65_scpu_aot_start(hw)'));}
console.log('SCPU_AOT_EXPORT_BOTH_MODES_PASS');
