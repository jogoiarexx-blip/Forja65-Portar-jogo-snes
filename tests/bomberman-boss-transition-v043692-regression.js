'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),C=require('../forja65-core');
const hash='3ce797fd0241fce8',k=C.bundledCfgKnowledge(hash);
assert(k.entries.length>=608);assert(new Set(k.entries.map(e=>e.address)).size>=549);
for(const m8 of [false,true])assert(k.entries.some(e=>e.address===0xCCA1C2&&!e.state.emulation&&e.state.m8===m8&&!e.state.x8&&e.state.carry===null));
assert.equal(C.bundledCfgKnowledge('0000000000000000'),null);
if(process.env.FORJA65_TEST_BOMBER_ROM){
 const r=C.loadRom(new Uint8Array(fs.readFileSync(process.env.FORJA65_TEST_BOMBER_ROM)));assert.equal(C.romFingerprint(r),hash);
 const off=C.snesToRom(r,0xCCA1C2);assert.equal(Buffer.from(r.data.slice(off,off+30)).toString('hex'),'c220a9e4ff9522a924009524a901009534c220a921c6856ae220a9ca856c');
 const a=C.analyze(r,8192,[],{summaryRounds:2});
 for(const m8 of [false,true])assert(a.functions.some(f=>f.start===0xCCA1C2&&f.entryState.m8===m8));
 const files=C.generateProject(r,a);assert(files['src/dispatch.cpp'].includes('0xCCA1C2u,false,false,false'));assert(files['src/dispatch.cpp'].includes('0xCCA1C2u,false,true,false'));
 console.log('BOSS_TRANSITION_REAL_ROM_V043692_PASS');
}
console.log('BOMBERMAN_BOSS_TRANSITION_V043692_PASS');
