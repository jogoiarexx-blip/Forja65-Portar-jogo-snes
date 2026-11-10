'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');
const bytes=C.makeSyntheticRom();
bytes[0x0100]=0x60; bytes[0x0110]=0x60; // $808100 code; $808110 is marked data below.
const rom=C.loadRom(bytes,'knowledge-fixture.sfc'),hash=C.romFingerprint(rom);
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash,sha256:null},producer:{project:'fixture'},entries:[
  {address:0x808100,name:'ExternalKnownRoutine',aliases:['KnownByOtherPort'],category:'OBJECT',state:{emulation:false,m8:false,x8:false,carry:null},priority:100,source:'fixture',evidence:['reviewed external boundary']}
,{address:0x808110,name:'ShouldBeRejectedAsData',aliases:[],category:'UNKNOWN',state:{emulation:false,m8:false,x8:false,carry:null},priority:90,source:'fixture',evidence:['known data region']}],dataRegions:[{start:0x808110,end:0x80811F,source:'fixture'}],dispatch:[],limits:[]};
const normalized=C.normalizeKnowledgePack(pack,hash);
assert.equal(normalized.entries.length,2);
const profile=C.mergeKnowledgeProfile({},pack,hash);
assert.equal(profile.symbols['808100'].name,'ExternalKnownRoutine');
assert.equal(profile.symbols['808100'].category,'OBJECT');
const a=C.analyze(rom,512,[],{knowledge:pack,knowledgeSeedLimit:16});
assert.equal(a.knowledgeSeedsImported,1);assert.equal(a.knowledgeDataSeedsRejected,1);
assert.ok(a.functions.some(f=>f.start===0x808100),'external knowledge must seed an otherwise unreachable CFG entry');
const map=C.buildNativeMap(rom,a,null,profile);
const node=map.routines.find(r=>r.address==='808100');
assert.ok(node);assert.equal(node.name,'ExternalKnownRoutine');assert.equal(node.category,'OBJECT');
const exported=C.knowledgePackFromNativeMap(map,{version:C.VERSION});
assert.equal(exported.schema,'forja65.knowledge.v1');assert.ok(exported.entries.some(e=>e.address===0x808100));
assert.throws(()=>C.normalizeKnowledgePack({...pack,rom:{fnv1a64:'deadbeef'}},hash),/fingerprint/i);
console.log('cross-project-knowledge-v0337-regression: OK');
