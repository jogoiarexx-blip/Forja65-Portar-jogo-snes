'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'synthetic-soldiers.sfc');
const proj=C.generateProject(rom,C.analyze(rom,500));
const runtime=proj['src/runtime.hpp'];
const dispatch=proj['src/dispatch.cpp'];
for(const expected of ['spcAdd8','spcSub8','case 0x98:', 'case 0x89:', 'case 0x99:', 'case 0xA9:', 'case 0xB8:', 'case 0xB9:', 'case 0x6A:', 'autoJoyReadBusy()const', 'AUTO_JOY_DURATION_MC=4224u', 'saveSpcTraceTail']){
  assert.ok(runtime.includes(expected),`missing generic runtime patch: ${expected}`);
}
assert.match(runtime,/autoJoyReadBusy\(\)\?1u:0u/);
assert.match(runtime,/f<<"seq,pc,opcode[^"\n]*\\n"/);
assert.match(dispatch,/if\(hw\.romOffset\(requested\)!=\(std::size_t\)-1&&hw\.read\(requested\)==0xDCu\)/);
console.log('SOLDIERS_GENERIC_SPC_HVBJOY_REGRESSION_PASS');
