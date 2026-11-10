'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');

// RAM-vector writer domain: a behavior pointer is selected from 4-byte records
// (companion pointer + handler pointer), then can be overridden by an immediate.
let d=C.makeSyntheticRom();d.fill(0xEA,0,0x900);
d.set([0x6C,0x63,0x19],0x0000); // $008000 JMP ($1963)
// $008040: DB=PB; A*4 -> Y; companion/table loads; STA vector; immediate override.
d.set([0x8B,0x4B,0xAB,0x0A,0x0A,0xA8,0xBE,0x00,0x82,0xB9,0x02,0x82,0x8D,0x63,0x19,0xA9,0x00,0x85,0x8D,0x63,0x19,0xAB,0x60],0x0040);
// records @ $008200; zero record terminates the domain.
const rec=[[0x8300,0x8400],[0x8310,0x8410],[0x8320,0x8420],[0,0]];
for(let n=0;n<rec.length;n++){const o=0x0200+n*4,[comp,handler]=rec[n];d[o]=comp&255;d[o+1]=comp>>8;d[o+2]=handler&255;d[o+3]=handler>>8;}
for(const o of [0x0300,0x0310,0x0320])d[o]=0xEA;
for(const o of [0x0400,0x0410,0x0420,0x0500])d[o]=0x60;
// restore a valid LoROM header after the fill.
const h=0x7FC0,title='FORJA65 WRITER DOMAIN';for(let i=0;i<21;i++)d[h+i]=i<title.length?title.charCodeAt(i):32;d[h+0x15]=0x20;d[h+0x16]=0;d[h+0x17]=5;d[h+0x1C]=0xCB;d[h+0x1D]=0xED;d[h+0x1E]=0x34;d[h+0x1F]=0x12;for(let o=0x20;o<0x40;o++)d[h+o]=0;d[h+0x3C]=0x00;d[h+0x3D]=0x80;
const rom=C.loadRom(d,'writer-domain.sfc'),hash=C.romFingerprint(rom),pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{project:'fixture'},entries:[],dataRegions:[],dispatch:[],limits:[]};
const f=C.focusAnalyze(rom,[0x008000],pack,{maxPerTarget:512}),site=f.results[0].indirect_sites.find(x=>x.pc===0x008000);
assert(site,'RAM-vector site missing');
assert.deepEqual(site.targets,[0x008400,0x008410,0x008420,0x008500]);
assert.equal(site.resolution.kind,'ram-vector-writer-domain');
assert.equal(site.resolution.direct_absolute_sta_sites,2);
assert.equal(site.resolution.direct_absolute_sta_covered,2);
assert.equal(site.resolution.direct_absolute_writer_closure,true);
assert.equal(site.resolution.record_tables.length,1);
assert.equal(site.resolution.record_tables[0].entries,3);
assert.equal(site.resolution.record_tables[0].stride,4);
assert.equal(site.resolution.record_tables[0].terminator.index,3);
assert.deepEqual(site.resolution.record_tables[0].targets,[0x008400,0x008410,0x008420]);
console.log('writer-domain-crossfeed-v0340-regression: OK');
