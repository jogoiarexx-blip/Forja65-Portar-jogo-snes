'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');
const bytes=C.makeSyntheticRom();
// A tiny reviewed AUDIO vector at $808000 jumps to a target that is otherwise UNKNOWN.
bytes[0x0000]=0x4C; bytes[0x0001]=0x20; bytes[0x0002]=0x80; // JMP $8020
bytes[0x0003]=0x60; // RTS
bytes[0x0020]=0x60; // target RTS
const rom=C.loadRom(bytes,'focused-crossfeed-fixture.sfc');
const hash=C.romFingerprint(rom);
const state={emulation:false,m8:false,x8:false,carry:null};
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash,sha256:null},producer:{project:'fixture'},entries:[
  {address:0x808000,name:'ReviewedAudioVector',aliases:[],category:'AUDIO',state,priority:100,source:'fixture',evidence:['reviewed vector'],span:{start:0x808000,end:0x808004,name:'ReviewedAudioVector'}},
  {address:0x808020,name:'UnknownTarget',aliases:[],category:'UNKNOWN',state,priority:20,source:'fixture',evidence:['catalog boundary'],span:{start:0x808020,end:0x808021,name:'UnknownTarget'}}
],dataRegions:[],dispatch:[],limits:[]};
const normalized=C.normalizeKnowledgePack(pack,hash);
assert.equal(normalized.entries[0].span.name,'ReviewedAudioVector');
const focus=C.focusAnalyze(rom,[0x808020],pack,{maxPerTarget:64});
assert.equal(focus.schema,'forja65.focus-analysis.v1');
assert.equal(focus.results.length,1);
const r=focus.results[0];
assert.equal(r.address,0x808020);
assert.equal(r.category,'AUDIO');
assert.equal(r.category_source,'direct-jump-family');
assert.equal(r.direct_jump_sources.length,1);
assert.equal(r.direct_jump_sources[0].address,0x808000);
assert.equal(r.direct_jump_sources[0].site,0x808000);
assert.equal(r.direct_jump_sources[0].kind,'JMP');
assert.ok(r.instructions>=1);
assert.equal(r.issues.length,0);
assert.throws(()=>C.normalizeKnowledgePack({...pack,entries:[{...pack.entries[0],span:{start:0x808010,end:0x808020,name:'bad'}}]},hash),/outside span/i);
console.log('focused-crossfeed-v0338-regression: OK');
