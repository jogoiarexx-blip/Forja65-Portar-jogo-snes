'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');
const d=C.makeSyntheticRom();d.fill(0xEA,0,0x100);
// JSR $8050 ; TXY ; TAX ; JMP ($8010,X)
d.set([0x20,0x50,0x80,0x9B,0xAA,0x7C,0x10,0x80],0x0000);
// Return values 0,2,4 select three pointer-table entries.
d.set([0x20,0x80,0x30,0x80,0x40,0x80],0x0010);d[0x0020]=0x60;d[0x0030]=0x60;d[0x0040]=0x60;
// Helper: every reachable RTS has a known immediate A value.
d.set([0xB5,0x10,0xF0,0x0A,0x30,0x04,0xA9,0x04,0x00,0x60,0xA9,0x02,0x00,0x60,0xA9,0x00,0x00,0x60],0x0050);
const rom=C.loadRom(d,'callee-return-index-domain.sfc'),hash=C.romFingerprint(rom);
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{project:'fixture'},entries:[],dataRegions:[],dispatch:[],limits:[]};
const out=C.focusAnalyze(rom,[0x008000],pack,{maxPerTarget:128});
const row=out.results[0];
assert(!row.issues.some(x=>x.kind==='CFG-DYNAMIC'));
const site=row.indirect_sites.find(x=>x.pc===0x008005);assert(site);
assert.equal(site.resolution.kind,'callee-return-index-domain');
assert.equal(site.resolution.helper,0x008050);
assert.deepEqual(site.resolution.return_values,[0,2,4]);
assert.deepEqual(site.targets,[0x008020,0x008030,0x008040]);
assert.equal(site.resolution.index_bounds_proven,true);
console.log('callee-return-index-domain-v0348-regression: OK');
