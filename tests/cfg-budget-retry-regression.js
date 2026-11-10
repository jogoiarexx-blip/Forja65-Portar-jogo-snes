'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core'),P=require('../tools/project-io');
// A long new routine must fit beside retained coverage, without evicting it.
const bytes=C.makeSyntheticRom();bytes.fill(0xEA,0x200,0x300);bytes[0x300]=0x60;
const rom=C.loadRom(bytes),hash=C.romFingerprint(rom),cache=P.makeCfgCache(C.analyze(rom,100),hash);
const state={emulation:true,m8:true,x8:true,carry:false};
const hints=[{rom:hash,target:0x8200,from:0x8000,kind:'FLOW',state}];
const retained=cache.functions.reduce((n,f)=>n+f.instructions.length,0);
const result=P.analyzeWithinCacheLimit(rom,400,hints,{},cache,hash,retained+20);
assert.ok(result.a.instructionVariants<=retained+20);
assert.ok(result.attempts.length>1);
assert.ok(result.a.functions.some(f=>f.instructions.some(i=>i.pc===0x8200)));
for(const f of cache.functions)assert.ok(result.a.functions.some(g=>g.functionKey===f.functionKey&&f.instructions.every(i=>g.instructions.some(j=>j.stateKey===i.stateKey))));
assert.throws(()=>P.analyzeWithinCacheLimit(rom,400,hints,{},cache,'bad',999),/incompatible/);
const tight=P.analyzeWithinCacheLimit(rom,400,hints,{},cache,hash,retained+1);
assert.equal(tight.a.instructionVariants,retained+1);
assert.throws(()=>P.analyzeWithinCacheLimit(rom,400,hints,{},cache,hash,retained),/ceiling|pending/);
console.log('CFG_BUDGET_RETRY_PASS attempts='+result.attempts.length);
