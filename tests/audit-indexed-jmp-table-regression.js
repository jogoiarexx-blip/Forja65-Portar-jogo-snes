'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core');
const {audit,parseAddress}=require('../tools/audit-indexed-jmp-table');
const raw=C.makeSyntheticRom();
// JMP ($8100,X) at $008040 -> targets $8120, $8140, $8160.
raw[0x40]=0x7c;raw[0x41]=0x00;raw[0x42]=0x81;
for(const [i,t] of [0x8120,0x8140,0x8160].entries()){raw[0x100+i*2]=t&255;raw[0x101+i*2]=t>>>8;}
const rom=C.loadRom(raw),hash=C.romFingerprint(rom);
const h=[{rom:hash,kind:'FLOW',from:0x008040,target:0x008140,observed:3}];
const r=audit(rom,parseAddress('$008040'),3,h);
assert.deepEqual(r.entries.map(e=>e.target),['$008120','$008140','$008160']);
assert.equal(r.entries[1].observedInThisRom,true);
assert.equal(r.entries[1].observations,3);
assert.equal(r.entries[0].observedInThisRom,false);
assert.throws(()=>audit(rom,0x008041,3),/not JMP/);
assert.throws(()=>audit(rom,0x008040,3,[{...h[0],rom:'bad'}]),/fingerprint/);
assert.throws(()=>audit(rom,0x008040,400),/1..256/);
console.log('INDEXED_JMP_TABLE_AUDIT_PASS');
