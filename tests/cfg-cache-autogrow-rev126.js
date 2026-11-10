'use strict';
const assert=require('node:assert/strict');
const Core=require('../forja65-core');
const IO=require('../tools/project-io');
const previousAnalyze=Core.analyze,previousMerge=Core.mergeCfgCoverageRecords;
let analyzed=0,seen=[];
try {
 Core.analyze=()=>{analyzed++;return {functions:[],runtimeHints:[]};};
 Core.mergeCfgCoverageRecords=(a,cache,hash,limit)=>{
  seen.push(limit);
  if(limit<7)throw new Error(`CFG cache variant ceiling (7 > ${limit}); refuse to write coverage above the configured limit`);
  return {a:{...a,cfgCacheUniqueInstructionVariants:7,instructionVariants:7},retained:0};
 };
 const rom={},opts={},hash='test';
 const got=IO.analyzeWithinCacheLimit(rom,64,[],opts,null,hash,3,null,[],131072);
 assert.deepEqual(seen,[3,8]);assert.equal(analyzed,1);assert.equal(got.cacheLimit,8);
 assert.equal(got.cacheLimitAutoGrew,true);assert.equal(got.attempts[0].requiredDistinct,7);
 seen=[];analyzed=0;
 assert.throws(()=>IO.analyzeWithinCacheLimit(rom,64,[],opts,null,hash,3,null,[],0),/CFG cache variant ceiling/);
 assert.deepEqual(seen,[3]);
 // Existing cached source cannot be evicted to fit the configured limit.
 seen=[];analyzed=0;
 const cache={schema:'forja65.cfg-coverage-cache.v1',rom:hash,version:Core.VERSION,functions:[]};
 const grown=IO.analyzeWithinCacheLimit(rom,64,[],opts,cache,hash,3,null,[],131072);
 assert.equal(grown.cacheLimit,8);assert.equal(analyzed,1);
 // Hard guard: a normal build cannot silently grow beyond the configured safety cap.
 Core.mergeCfgCoverageRecords=()=>{throw Error('CFG cache variant ceiling (131073 > 131072); refuse to evict previously decoded routines silently');};
 assert.throws(()=>IO.analyzeWithinCacheLimit(rom,64,[],opts,null,hash,32768,null,[],131072),/CFG cache variant ceiling/);
 console.log('REV126 CFG AUTO GROW PASS (no re-analysis, manual bound, cached preservation, hard cap)');
} finally {Core.analyze=previousAnalyze;Core.mergeCfgCoverageRecords=previousMerge;}
