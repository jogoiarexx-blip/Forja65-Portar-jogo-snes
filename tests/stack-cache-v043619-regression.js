// Historical pinned decoder audit on actual .86 source. Current graph is tested separately.
"use strict";
const C=require('../crossfeed-historico/v043686-pendencias/forja65-core'),P=require('../crossfeed-historico/v043618/forja65-core'),IO=require('../crossfeed-historico/v043686-pendencias/tools/project-io'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function engine(file){const s=fs.readFileSync(file,'utf8');return s.slice(s.indexOf('function hex('),s.indexOf('function cppHex('));}
assert.equal(engine(path.join(__dirname,'../crossfeed-historico/v043686-pendencias/forja65-core.js')),engine(path.join(__dirname,'../crossfeed-historico/v043618/forja65-core.js')),'grant output-only compatibility only while decoder/CFG are byte identical');
const bytes=C.makeSyntheticRom();bytes.set([0xf4,0xcd,0xab,0xdb],0);const r=C.loadRom(bytes),old=P.loadRom(bytes),hash=C.romFingerprint(r),cache=IO.makeCfgCache(P.analyze(old,128),hash);assert.equal(cache.version,C.VERSION);cache.version=P.VERSION;
assert(IO.isAuditedCacheVersion(P.VERSION));const merged=IO.mergeCfgCoverage(C.analyze(r,64),cache,hash).a,files=C.generateProject(r,merged);
assert(Object.entries(files).some(([n,v])=>/^src\/generated_.*cpp$/.test(n)&&v.includes('cpu.push16Value(hw, 0xABCDu,true)')),'old analysis must emit current extended-stack semantics');assert(files['src/runtime.hpp'].includes('popLongReturn'));
assert.throws(()=>IO.mergeCfgCoverage(merged,{...cache,version:'0.4.36.18-fake'},hash),/incompatible/);assert.throws(()=>IO.mergeCfgCoverage(merged,{...cache,rom:'bad'},hash),/incompatible/);
console.log('STACK_CACHE_V043619_PASS static_identical=1 cache18=accepted emitter=regenerated fake=rejected wrong_rom=rejected');
