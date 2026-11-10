// Historical pinned decoder audit on actual .86 source. Current graph is tested separately.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const F=require('../crossfeed-historico/v043686-pendencias/forja65-core'),IO=require('../crossfeed-historico/v043686-pendencias/tools/project-io');
const source=fs.readFileSync(require.resolve('../crossfeed-historico/v043686-pendencias/forja65-core'),'utf8');
const decoder=source.slice(source.indexOf('function hex('),source.indexOf('function cppHex('));
// Pinned from v0.4.36.64: this permission must fail if CPU/CFG changes.
assert.equal(crypto.createHash('sha256').update(decoder).digest('hex'),
 'e230d3c3223e2ad3e356276ec3af69d844264349972604d036166f750ecb8005');
const previous='0.4.36.64-ppu-oam-shared-byte-cursor';
assert.equal(IO.isAuditedCacheVersion(previous),true);
assert.equal(IO.isAuditedCacheVersion(previous+'-fake'),false);
const r=F.loadRom(F.makeSyntheticRom()),a=F.analyze(r,128),hash=F.romFingerprint(r);
const cache={...IO.makeCfgCache(a,hash),version:previous};
const merged=IO.mergeCfgCoverage(a,cache,hash).a;
assert.throws(()=>IO.mergeCfgCoverage(a,{...cache,rom:'wrong'},hash),/incompatible/);
const files=F.generateProject(r,merged);
assert.ok(files['forja65-build-manifest.txt'].includes('forja65_version='+F.VERSION));
console.log('TRACE_BUILD_CACHE_V043665_PASS previous=64 decoder=identical wrong_rom=rejected fake=rejected');
