// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const assert=require('assert');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'cutover.sfc');
const a=C.analyze(rom,4096);
const p=C.generateProject(rom,a);
const vm=C.VERSION.match(/^0\.(3|4)\.(\d+)/); assert.ok(vm&&(Number(vm[1])>3||Number(vm[2])>=29),C.VERSION);
for(const f of [
  'RUN-NATIVE-CUTOVER.cmd','RUN-NATIVE-AUDIO.cmd','RUN-ROM-CONVERGE.cmd',
  'PACKAGE-NATIVE-WITHOUT-ROM.cmd','RUN-NATIVE-PORT.cmd',
  'docs/NATIVE-HARDWARE-MIGRATION.txt','tests/native_migration_smoke.cpp'
]) assert.ok(p[f],`missing ${f}`);
const rt=String(p['src/runtime.hpp']);
for(const q of [
  'ppuFallbackReads','ppuFallbackWrites','nativeDspEnabled','DSP_SAMPLE_MASTER_CYCLES',
  'saveNativeAudioWav','coverageBytes','coveragePercent','FORJA65_AUDIO_MODE',
  'DSP_NATIVE_BACKEND','ROM_NATIVE_READY','dspNativeSamples','dspFallbackSamples'
]) assert.ok(rt.includes(q),`runtime missing ${q}`);
const smoke=String(p['tests/native_migration_smoke.cpp']);
for(const q of ['native-audio-smoke.wav','dspNativeSamples','ppuFallbackReads','coveragePercent'])
  assert.ok(smoke.includes(q),`migration smoke missing ${q}`);
const docs=String(p['docs/NATIVE-HARDWARE-MIGRATION.txt']);
for(const q of ['PPU_NATIVE_ONLY','FORJA65_AUDIO_MODE=native','RUN-ROM-CONVERGE.cmd','PACKAGE-NATIVE-WITHOUT-ROM.cmd'])
  assert.ok(docs.includes(q),`docs missing ${q}`);
const meta=JSON.parse(p['analysis.json']);
for(const q of [
  'ppu_fallback_accounting','native_dsp_clock','native_dsp_pcm','native_audio_wav_dump',
  'native_rom_coverage_report','rom_convergence_script','native_release_without_cart'
]) assert.strictEqual(meta.hardware[q],true,q);
console.log('native-hardware-cutover-v0329-regression: OK');
