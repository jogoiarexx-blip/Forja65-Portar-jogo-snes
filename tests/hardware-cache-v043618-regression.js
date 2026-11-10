// Historical supplied .86 proof; current cache graph is checked separately in crossfeed-combined.
"use strict";
const C=require('../crossfeed-historico/v043686-pendencias/forja65-core'),IO=require('../crossfeed-historico/v043686-pendencias/tools/project-io'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function engine(file){const s=fs.readFileSync(file,'utf8');return s.slice(s.indexOf('function hex('),s.indexOf('function cppHex('));}
assert.equal(engine(path.join(__dirname,'../crossfeed-historico/v043686-pendencias/forja65-core.js')),engine(path.join(__dirname,'../crossfeed-historico/v043617/forja65-core.js')),'static decoder and CFG must remain identical before accepting v17 cache');
const r=C.loadRom(C.makeSyntheticRom()),a=C.analyze(r,256),hash=C.romFingerprint(r),cache={...IO.makeCfgCache(a,hash),version:'0.4.36.17-iterative-cpu-calls'};
assert(IO.isAuditedCacheVersion(cache.version));const merged=IO.mergeCfgCoverage(C.analyze(r,64),cache,hash).a,p=C.generateProject(r,merged);
assert(p['src/runtime.hpp'].includes('vramReadBlocked'));assert(p['src/runtime.hpp'].includes('readDpPointer(hw,p,true)'));
assert.throws(()=>IO.mergeCfgCoverage(a,{...cache,rom:'bad'},hash),/incompatible/);assert.throws(()=>IO.mergeCfgCoverage(a,{...cache,version:'0.4.36.17-fake'},hash),/incompatible/);
console.log('HARDWARE_CACHE_V043618_PASS static_identical=1 cache17=accepted current_runtime=regenerated wrong_rom=rejected fake=rejected');
