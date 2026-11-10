'use strict';
// Bank carry is generated into *each* game runtime. Guard against regressions
// in both the generated header and in the global CTest target.
const assert=require('node:assert/strict');
const Forja=require('../forja65-core.js');
const synthetic=Forja.makeSyntheticRom();
synthetic[0]=0xDB; // STP
const rom=Forja.loadRom(synthetic,'bank-carry-test.sfc');
const project=Forja.generateProject(rom,Forja.analyze(rom,1024));
const header=project['src/runtime.hpp'];
const source=project['tests/cpu_bank_cross_smoke.cpp'];
const cmake=project['CMakeLists.txt'];
assert.ok(header.includes('(((std::uint32_t)db<<16)+(q&0xFFFFu)+x)&0xFFFFFFu'), 'abs X must carry to next data bank');
assert.ok(header.includes('(((std::uint32_t)db<<16)+(q&0xFFFFu)+y)&0xFFFFFFu'), 'abs Y must carry to next data bank');
assert.ok(header.includes('(((std::uint32_t)db<<16)+base+y)&0xFFFFFFu'), 'indirect Y must carry to next bank');
assert.ok(source.includes('bank 7F destination'));
assert.ok(source.includes('24-bit address bus must wrap'));
assert.ok(cmake.includes('add_test(NAME cpu_bank_cross_smoke'));
console.log('BANK_CARRY_GENERATION_PASS: abs X/Y, indirect Y and CTest coverage');
