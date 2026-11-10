// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const assert=require('assert');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'native-audit.sfc');
const a=C.analyze(rom,4096);
const p=C.generateProject(rom,a);
const vm=C.VERSION.match(/^0\.(3|4)\.(\d+)/); assert.ok(vm&&(Number(vm[1])>3||Number(vm[2])>=27),C.VERSION);
for(const f of ['RUN-NATIVE-AUDIT.cmd','docs/NATIVE-DEPENDENCY-AUDIT.txt','tests/native_dependency_smoke.cpp']) assert.ok(p[f],`missing ${f}`);
const rt=String(p['src/runtime.hpp']);
for(const q of ['struct HardwareUsage','FORJA65_NATIVE_AUDIT','forja65-native-dependency.csv','FORJA65_NATIVE_DEPENDENCY_AUDIT 1','romReads','ppuReads','apuReads','dmaBytes','hdmaBytes','firstRomPc','firstPpuPc','firstApuPc']) assert.ok(rt.includes(q),`runtime missing ${q}`);
const main=String(p['src/main.cpp']);
assert.ok(main.includes('writeNativeDependencyReport'));
assert.ok(main.includes('ppu_virtual_accesses'));
const cm=String(p['CMakeLists.txt']);
assert.ok(cm.includes('native_dependency_smoke'));
assert.ok(cm.includes('add_test(NAME native_dependency_smoke'));
const meta=JSON.parse(p['analysis.json']);
for(const q of ['native_dependency_audit','per_frame_hardware_usage','rom_runtime_read_counter','ppu_runtime_access_counter','apu_runtime_access_counter','dma_hdma_byte_counter','first_hardware_use_pc']) assert.strictEqual(meta.hardware[q],true,q);
console.log('native-dependency-audit-v0327-regression: OK');
