'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),C=require('../forja65-core');
const k=C.bundledCfgKnowledge('3ce797fd0241fce8');
// REV216 adds observed discovery seeds; retain the historical catalog assertions.
const historical=k.entries.filter(e=>e.source!=='bomberman-v057-v059-observed-interpreter-rev216');
assert.equal(historical.length,620);assert.equal(new Set(historical.map(e=>e.address)).size,554);
for(const pc of [0xCC9FF2,0xCC9FF6,0xCCA014,0xCCA022,0xCCA04C])for(const m8 of [false,true])assert(k.entries.some(e=>e.address===pc&&e.state.m8===m8&&!e.state.emulation&&!e.state.x8&&e.state.carry===null));
assert(k.entries.some(e=>e.address===0xCC9F42&&e.state.m8));
assert.equal(C.bundledCfgKnowledge('0000000000000000'),null);
if(process.env.FORJA65_TEST_BOMBER_ROM){
 const rom=C.loadRom(new Uint8Array(fs.readFileSync(process.env.FORJA65_TEST_BOMBER_ROM)));assert.equal(C.romFingerprint(rom),'3ce797fd0241fce8');
 const off=C.snesToRom(rom,0xCC9FF2);assert.equal(Buffer.from(rom.data.slice(off,off+8)).toString('hex'),'22bee4ccc220d634');
 const a=C.analyze(rom,8192,[],{summaryRounds:2});assert.equal(a.bundledCfgEntries,k.entries.length);
 const files=C.generateProject(rom,a),d=files['src/dispatch.cpp'];for(const pc of ['CC9FF2','CCA022','CCA04C'])for(const m of ['false','true'])assert(d.includes('0x'+pc+'u,false,'+m+',false'));
 console.log('TIMED_CALLBACK_REAL_ROM_V043693_PASS');
}
console.log('BOMBERMAN_TIMED_STATE_V043693_PASS');
