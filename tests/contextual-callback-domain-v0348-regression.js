'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');
const d=C.makeSyntheticRom();d.fill(0xEA,0,0x100);
d.set([0x4C,0x20,0x80],0x0000); // $008000 -> shared callback jump
 d.set([0x4C,0x20,0x80],0x0010); // $008010 -> same shared site
 d.set([0x6C,0x10,0x00],0x0020); // $008020 JMP ($0010)
d[0x0030]=0x60;d[0x0040]=0x60;d[0x0050]=0x60;
const rom=C.loadRom(d,'contextual-callback-domain.sfc'),hash=C.romFingerprint(rom);
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{project:'fixture'},entries:[],dataRegions:[],dispatch:[{
 site:0x008020,targets:[0x008030,0x008040,0x008050],source:'fixture-union',
 contexts:[
  {root:0x008000,targets:[0x008030,0x008040],source:'fixture-root0',resolution:{kind:'fixture-context',command:3}},
  {root:0x008010,targets:[0x008050],source:'fixture-root1',resolution:{kind:'fixture-context',command:4}}
 ]
}],limits:[]};
const out=C.focusAnalyze(rom,[0x008000,0x008010],pack,{maxPerTarget:64});
assert.equal(out.results.length,2);
const a=out.results[0].indirect_sites.find(x=>x.pc===0x008020);
const b=out.results[1].indirect_sites.find(x=>x.pc===0x008020);
assert(a&&b);
assert.deepEqual(a.knowledge_targets,[0x008030,0x008040]);
assert.deepEqual(b.knowledge_targets,[0x008050]);
assert.equal(a.resolution.knowledge_resolution.kind,'fixture-context');
assert.equal(b.resolution.knowledge_resolution.kind,'fixture-context');
console.log('contextual-callback-domain-v0348-regression: OK');
