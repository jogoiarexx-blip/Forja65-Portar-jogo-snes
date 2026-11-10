// REV174: match current fail-closed diagnostic from REV169; actual corrupt-source rejection is exercised in REV174 CMake integration.
// Generator regression: a newly generated Mega Man X2 project must not
// inherit the REV166 .download typo or link an unchecked Cx4 backend.
'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const rom=F.makeSyntheticRom();rom[0x7fbf]=0x10;rom[0x7fd6]=0xf3;
const cart=F.loadRom(rom);assert.equal(cart.header.coprocessor,'CX4');
const files=F.generateProject(cart,F.analyze(cart,256));
const sh=files['INSTALAR-CX4-LINUX.sh'];
const ps=files['tools/install-cx4.ps1'];
const cmake=files['CMakeLists.txt'];
assert.match(sh,/cx4\.c cx4\.h saveload\.h/);
assert.match(sh,/sha256sum --check --status/);
assert.match(sh,/FORJA65_CX4_SOURCE_DIR/);
assert.doesNotMatch(sh,/download\.download/);
assert.match(ps,/Get-FileHash/);
assert.match(ps,/FORJA65_CX4_SOURCE_DIR/);
assert.match(cmake,/Cx4 SHA256 mismatch/);
assert.match(cmake,/FORJA65_REQUIRE_CX4 "Require the real Cx4 backend for a runnable game" ON/);
assert.ok(cmake.indexOf('option(FORJA65_REQUIRE_CX4') < cmake.indexOf('if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/src/cx4_vendor/cx4.c"'));
assert.match(files['src/cx4_vendor/saveload.h'],/bool \(\*peek\)/);
assert.match(files['CX4-PINNED-SOURCE-REV167.txt'],/790748ac955465a5aa3d919aad4c6baeed53c114d74aad21ae6da1a91b360c41/);
console.log('REV167_GENERATOR_PASS pinned_upstream hash_guard offline_install ABI default_gate');
