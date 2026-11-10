'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'v0374.sfc');
const output=F.generateProject(rom,F.analyze(rom,350));
for(const script of ['BUILD-WINDOWS.cmd','BUILD-QUALITY-WINDOWS.cmd']){
 const cmd=output[script];
 assert.match(cmd,/cmake --build build-(?:win|quality) --config (?:Release|RelWithDebInfo) --parallel 2 \|\| goto :err/);
 assert.doesNotMatch(cmd,/cmake --build [^\r\n]* --target /);
 assert.match(cmd,/ctest --test-dir build-(?:win|quality) -C (?:Release|RelWithDebInfo) --output-on-failure/);
}
for(const name of ['ppu_timeline_smoke','headless_budget_smoke','framework_smoke']){
 assert.match(output['CMakeLists.txt'],new RegExp('add_(?:executable|test)\\([^\\n]*'+name));
}
console.log('WINDOWS_CTEST_TARGETS_V0374_PASS');
