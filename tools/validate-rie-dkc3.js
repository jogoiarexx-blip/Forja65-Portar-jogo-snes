#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks'),C=require('../forja65-core'),Old=require('../crossfeed-historico/v043693-rie-baseline/forja65-core'),{createInventoryCache}=require('./rie-cache');
const file=path.resolve(__dirname,'../reports/validation-crossfeed-0396/bbab29-integrated/generated/assets/cart-data.bin'),dir=path.resolve(__dirname,'../reports/rie-v043694/dkc3');fs.mkdirSync(dir,{recursive:true});
const r=C.loadRom(new Uint8Array(fs.readFileSync(file)),'DKC3 bundled port data'),hints=fs.readFileSync(path.join(path.dirname(path.dirname(file)),'analysis/runtime-hints.txt'),'utf8'),cache=createInventoryCache(path.join(dir,'rie-scan-cache'));
let t=performance.now();const before=Old.analyze(r,2048,hints,{summaryRounds:2});const beforeMs=performance.now()-t;
t=performance.now();const after=C.analyze(r,2048,hints,{summaryRounds:2,inventoryCache:cache});const coldMs=performance.now()-t;
t=performance.now();const warm=C.analyze(r,2048,hints,{summaryRounds:2,inventoryCache:cache});const warmMs=performance.now()-t;
assert.deepEqual(after.functions,before.functions);assert.deepEqual(after.issues,before.issues);assert.deepEqual(warm.functions,after.functions);
const oldFiles=Old.generateProject(r,before),newFiles=C.generateProject(r,after,{inventoryCache:cache});let comparedCpp=0;
for(const n of Object.keys(newFiles).filter(n=>n.startsWith('src/'))){assert.deepEqual(newFiles[n],oldFiles[n],n);comparedCpp++;}
const result={rom:{title:r.header.title,fnv1a64:C.romFingerprint(r),mapping:r.header.mapping,size:r.data.length},analysisBudget:2048,summaryRounds:2,beforeMs,coldMs,warmMs,functions:after.functions.length,decoded:after.decoded,issues:after.issues.length,summaryConverged:after.summaryConverged,cppFilesIdentical:comparedCpp,inventory:after.romInventory.metrics,warmInventory:warm.romInventory.metrics,gameplayValidated:false,limitation:'Bounded analysis and C++ comparison only; no replay, stage transition, audio or crash validation.'};
fs.writeFileSync(path.join(dir,'before-after.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(dir,'rom-inventory.json'),newFiles['analysis/rom-inventory.json']);fs.writeFileSync(path.join(dir,'rom-inventory.md'),newFiles['analysis/rom-inventory.md']);console.log(JSON.stringify(result,null,2));
