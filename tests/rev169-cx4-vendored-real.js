#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../forja65-core.js');
const rom=C.makeSyntheticRom();rom[0x7fbf]=0x10;rom[0x7fd6]=0xf3;
const loaded=C.loadRom(rom);assert.equal(loaded.header.coprocessor,'CX4');
const files=C.generateProject(loaded,C.analyze(loaded,256));
const vendor=path.join(__dirname,'..','vendor','cx4');
for(const file of ['cx4.c','cx4.h','saveload.h']){
 const key='src/cx4_vendor/'+file;
 assert.equal(typeof files[key],'string','missing embedded '+key);
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 assert.equal(hash(files[key]),hash(fs.readFileSync(path.join(vendor,file),'utf8')),'generator differs from vendored '+file);
}
assert(files['src/cx4_vendor/cx4.c'].includes('cx4_execute_opcode'));
assert(files['src/cx4_vendor/cx4.c'].includes('cx4_synthesize_data_rom'));
assert.match(files['CMakeLists.txt'],/0cd22334f8ef300bf126d52f7992db3a4d485eb56515ce4fe3c2c217264826f2/);
assert.match(files['src/cx4_vendor/CX4-LICENSE-NOTICE.txt'],/ISC License/);
assert.match(files['CX4-PROVENANCE-REV169.json'],/original_upstream_sha256/);
console.log('REV169_CX4_REAL_GENERATOR_PASS vendor hash matching; pin and license retained');
