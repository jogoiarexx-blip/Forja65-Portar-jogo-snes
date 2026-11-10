'use strict';
// Specific to the REV164->REV165 Cx4 checkpoint/QA integration.
// This is a GENERATOR TEST, not proof of the game's DSP execution.
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const testRom=F.makeSyntheticRom();
testRom[0x7fbf]=0x10; testRom[0x7fd6]=0xf3;
const cart=F.loadRom(testRom);
assert.equal(cart.header.coprocessor,'CX4');
const files=F.generateProject(cart,F.analyze(cart,256));
const ck=files['src/forja_checkpoint.hpp'];
assert.match(ck,/FORJA65_CHECKPOINT_V3/);
assert.match(ck,/kVersion=3/);
assert.match(ck,/cx4_saveload\(device,&callbacks\)/);
assert.match(ck,/cx4_saveload_clock\(device,&callbacks\)/);
assert.match(files['src/runtime.hpp'],/cx4_data_rom_reads=/);
assert.match(files['src/runtime.hpp'],/cx4_rdrom_hits\(cx4Device\.get\(\)\)/);
assert.match(files['src/runtime.hpp'],/cx4_run_ring_count\(cx4Device\.get\(\)\)/);
assert.match(files['src/runtime.hpp'],/cx4_boot_table_coverage_observed=/);
assert.match(files['src/main.cpp'],/intro_stage_cleared=NOT_VERIFIED/);
assert.match(files['INSTALAR-CX4-LINUX.sh'],/cx4_synthesize_data_rom.*\$tmp\/cx4\.c/);
assert.doesNotMatch(files['INSTALAR-CX4-LINUX.sh'],/cx4_synthesize_data_rom.*\$dir\/cx4\.c/);
console.log('REV166_MM_X2_CROSSFEED_GENERATOR_PASS checkpoint_V3 DSP counters installer stage-guard');
