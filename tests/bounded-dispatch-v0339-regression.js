'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');

// Structural inline table with an exact external data-region extent. The local
// mask permits 0..127, while the table contains only 3 entries; this is resolved
// structurally but MUST remain flagged as runtime-index-domain unproven.
let d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);
d.set([0xC2,0x30,0x29,0x7F,0x00,0x0A,0xAA,0x7C,0x0A,0x80],0x0000);
d.set([0x10,0x80,0x14,0x80,0x18,0x80],0x000A);
d[0x0010]=0x60;d[0x0014]=0x60;d[0x0018]=0x60;
let rom=C.loadRom(d,'bounded-inline.sfc'),hash=C.romFingerprint(rom);
let pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash,sha256:null},producer:{project:'fixture'},entries:[],dataRegions:[{start:0x00800A,end:0x008010,source:'fixture-exact-table'}],dispatch:[],limits:[]};
let f=C.focusAnalyze(rom,[0x008000],pack,{maxPerTarget:128});
let r=f.results[0],site=r.indirect_sites.find(x=>x.pc===0x008007);
assert(site,'inline dispatch site missing');
assert.equal(site.resolution.kind,'inline-structural-table');
assert.equal(site.resolution.entries,3);
assert.equal(site.resolution.unique_targets,3);
assert.equal(site.resolution.table_extent_proven,true);
assert.equal(site.resolution.index_domain.mask,0x007F);
assert.equal(site.resolution.index_domain_fits_table,false);
assert.deepEqual(site.targets,[0x008010,0x008014,0x008018]);
assert(!r.issues.some(x=>x.kind==='CFG-DYNAMIC'),'structural inline table remained dynamic');
assert(r.issues.some(x=>x.kind==='CFG-RESOLVED-INDIRECT'),'structural table not marked resolved');
assert(r.issues.some(x=>x.kind==='CFG-INDEX-DOMAIN-UNPROVEN'),'unproven runtime index domain was not surfaced');

// A knowledge-pack dispatch hint must turn an otherwise opaque RAM vector into a
// bounded candidate and feed the target into the focused CFG.
d=C.makeSyntheticRom();d.fill(0xEA,0,0x200);d.set([0x6C,0x4A,0x00],0);d[0x100]=0x60;
rom=C.loadRom(d,'knowledge-dispatch.sfc');hash=C.romFingerprint(rom);
pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash,sha256:null},producer:{project:'fixture'},entries:[],dataRegions:[],dispatch:[{site:0x008000,targets:[0x008100],source:'roundtrip',resolution:{kind:'fixture-proof',writer_closed:true}}],limits:[]};
assert.equal(C.normalizeKnowledgePack(pack,hash).dispatch[0].resolution.kind,'fixture-proof');
f=C.focusAnalyze(rom,[0x008000],pack,{maxPerTarget:64});r=f.results[0];site=r.indirect_sites.find(x=>x.pc===0x008000);
assert(site,'knowledge dispatch site missing');
assert.deepEqual(site.knowledge_targets,[0x008100]);
assert(site.targets.includes(0x008100));
assert(!r.issues.some(x=>x.kind==='CFG-DYNAMIC'),'knowledge dispatch did not resolve CFG');
// The same knowledge dispatch must be honored by whole-project analysis, not only focus mode.
const whole=C.analyze(rom,128,[],{knowledge:pack,knowledgeSeedLimit:0,summaryRounds:0});
assert(whole.functions.some(fn=>(fn.instructions||[]).some(i=>i.pc===0x008100)),'whole analysis did not enqueue knowledge dispatch target');
assert(!whole.issues.some(x=>x.kind==='CFG-DYNAMIC'&&x.pc===0x008000),'whole analysis ignored knowledge dispatch');
console.log('bounded-dispatch-v0339-regression: OK');
