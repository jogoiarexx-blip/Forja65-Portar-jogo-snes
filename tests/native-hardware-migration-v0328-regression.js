// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const assert=require('assert');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'migration.sfc');
const a=C.analyze(rom,4096);
const p=C.generateProject(rom,a);
const vm=C.VERSION.match(/^0\.(3|4)\.(\d+)/); assert.ok(vm&&(Number(vm[1])>3||Number(vm[2])>=28),C.VERSION);
for(const f of ['RUN-NATIVE-MIGRATION.cmd','RUN-ROM-PROFILE.cmd','BUILD-NATIVE-ROM-PACK.cmd','RUN-ROM-NATIVE.cmd','RUN-CAPTURE-SPC.cmd','docs/NATIVE-HARDWARE-MIGRATION.txt','tests/native_migration_smoke.cpp','tools/rom_pack_builder.cpp']) assert.ok(p[f],`missing ${f}`);
const rt=String(p['src/runtime.hpp']);
for(const q of ['enum class RomRuntimeMode','enum class PpuRuntimeMode','struct NativeRomStore','FORJA65_ROM_MODE','FORJA65_PPU_MODE','FORJA65_DMA_MODE','FORJA65_CAPTURE_SPC_FRAME','nativeDmaEnabled','dmaNativeBytes','hdmaNativeBytes','romNativeReads','setNativeStepHook','saveRomReadProfile']) assert.ok(rt.includes(q),`runtime missing ${q}`);
const cm=String(p['CMakeLists.txt']);
for(const q of ['native_migration_smoke','rom_pack_builder','FORJA65_NATIVE_SPC_LINKED','src/spc700_native.cpp']) assert.ok(cm.includes(q),`cmake missing ${q}`);
const main=String(p['src/main.cpp']);
assert.ok(main.includes('ROM/native pack fingerprint mismatch'));
assert.ok(main.includes('ppu_native_accesses'));
const meta=JSON.parse(p['analysis.json']);
for(const q of ['ppu_state_only_native_scanout','native_dma_bbus_fastpath','native_hdma_bbus_fastpath','spc_snapshot_capture','native_spc_aot_hook','rom_read_profile','sparse_native_rom_pack','native_rom_only_mode']) assert.strictEqual(meta.hardware[q],true,q);
console.log('native-hardware-migration-v0328-regression: OK');
