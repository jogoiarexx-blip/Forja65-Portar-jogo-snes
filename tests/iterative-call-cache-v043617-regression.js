// Historical pinned decoder audit on actual .86 source. Current graph is tested separately.
'use strict';
const C=require('../crossfeed-historico/v043686-pendencias/forja65-core'),IO=require('../crossfeed-historico/v043686-pendencias/tools/project-io'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const next='0.4.36.17-iterative-cpu-calls',previous='0.4.36.16-cfg-cpu-addressing';
assert.equal(IO.isAuditedCacheVersion(previous,next),true,'output-only iterative calls must allow audited v16 CFG');
function engine(file){const s=fs.readFileSync(file,'utf8');return s.slice(s.indexOf('function hex('),s.indexOf('function cppHex('));}
const current=engine(path.join(__dirname,'../crossfeed-historico/v043686-pendencias/forja65-core.js')),prior=engine(path.join(__dirname,'../crossfeed-historico/v043616/forja65-core.js'));
assert.equal(crypto.createHash('sha256').update(current).digest('hex'),crypto.createHash('sha256').update(prior).digest('hex'),'do not accept old caches if ROM decoder/CFG changed');
assert.equal(IO.isAuditedCacheVersion(next),true,'active emitter must still allow the audited v17 analysis');
assert.equal(IO.isAuditedCacheVersion('0.4.36.2-dkc3-ppu-audit'),false);
const r=C.loadRom(C.makeSyntheticRom()),a=C.analyze(r,256),hash=C.romFingerprint(r);
const cache={...IO.makeCfgCache(a,hash),version:previous};
const fresh=IO.mergeCfgCoverage(C.analyze(r,64),cache,hash).a;
const p=C.generateProject(r,fresh);
assert(p['src/dispatch.cpp'].includes('continueInternalReturn'));
assert(p['src/runtime.hpp'].includes('#define FORJA65_STACKLESS_CALLS 1'));
assert.throws(()=>IO.mergeCfgCoverage(a,{...cache,rom:'bad'},hash),/incompatible/);
assert.throws(()=>IO.mergeCfgCoverage(a,{...cache,version:'0.4.36.16-fake'},hash),/incompatible/);
console.log('ITERATIVE_CALL_CACHE_V043617_PASS decoder_identical=1 old_cache=accepted emitter=regenerated wrong_rom=rejected fake=rejected');
