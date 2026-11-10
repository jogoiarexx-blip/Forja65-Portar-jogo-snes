#!/usr/bin/env node
'use strict';
const C=require('../forja65-core'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function cx4VectorRom(){
 const rom=C.makeSyntheticRom(); rom[0x7fd6]=0xF3;rom[0x7fbf]=0x10;rom[0x7fc0]=0x43;rom[0x7fc1]=0x58;rom[0x100]=0x40; // RTI at $8100
 for(const a of [0x7fe4,0x7fe6,0x7fe8,0x7ff4,0x7ff8]){rom[a]=0x00;rom[a+1]=0x81;}
 return rom;
}
const bytes=cx4VectorRom(),rom=C.loadRom(bytes);
assert.equal(rom.header.coprocessor,'CX4');assert.equal(rom.header.mapping,'LoROM');
const a=C.analyze(rom,4096,[],{globalCfgRounds:1,globalCfgBudget:128});
assert(a.rieGlobal.roots.some(r=>r.vector===0xffe4&&r.start===0x8100));
assert(a.functions.some(f=>f.start===0x8100));
assert.equal(a.rieGlobal.executedEvidence,false);
const guarded=C.analyze(rom,4096,[],{knowledge:{schema:'forja65.knowledge.v1',entries:[],dataRegions:[{start:0x8100,end:0x8100}]}});
assert(!guarded.rieGlobal.roots.some(r=>r.start===0x8100),'Cx4 cannot bypass data exclusions');
// For other custom chips, the intentionally conservative mapper guard remains.
const unsupported=C.makeSyntheticRom();unsupported[0x7fd6]=0xF3;unsupported[0x7fbf]=0x55;
for(const v of [0x7fe4,0x7fe6,0x7fe8,0x7ff4,0x7ff8]){unsupported[v]=0;unsupported[v+1]=0x81;}
const u=C.analyze(C.loadRom(unsupported),2048);
assert(u.rieGlobal.rejectedRoots.some(x=>x.reason==='unsupported-coprocessor-base-map-only'));
if(process.argv[2]){
 const original=C.loadRom(new Uint8Array(fs.readFileSync(process.argv[2])));
 assert.equal(original.header.coprocessor,'CX4');
 const covered=C.analyze(original,2048);
 console.log('MMX2_CX4_CFG_UNDER_TEST',JSON.stringify({decoded:covered.decoded,functions:covered.functions.length,roots:covered.rieGlobal.roots.length,rejected:covered.rieGlobal.rejectedRoots.map(r=>r.reason)}));
}
console.log('REV168_CX4_VECTOR_STATIC_GUARD_PASS');
