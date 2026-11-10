// Historical pinned decoder audit on actual .86 source. Current graph is tested separately.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const F=require('../crossfeed-historico/v043686-pendencias/forja65-core'),IO=require('../crossfeed-historico/v043686-pendencias/tools/project-io');
const next='0.4.36.66-open-source-hardware';
const previous='0.4.36.65-trace-disabled-build-fix';
const source=fs.readFileSync(require.resolve('../crossfeed-historico/v043686-pendencias/forja65-core'),'utf8');
const decoder=source.slice(source.indexOf('function hex('),source.indexOf('function cppHex('));
assert.equal(crypto.createHash('sha256').update(decoder).digest('hex'),'e230d3c3223e2ad3e356276ec3af69d844264349972604d036166f750ecb8005');
assert.equal(IO.isAuditedCacheVersion(previous,next),true);
assert.equal(IO.isAuditedCacheVersion(previous+'-fake',next),false);
const rom=F.loadRom(F.makeSyntheticRom()),a=F.analyze(rom,128),hash=F.romFingerprint(rom);
const cache={...IO.makeCfgCache(a,hash),version:previous};
IO.mergeCfgCoverage(a,cache,hash);
assert.throws(()=>IO.mergeCfgCoverage(a,{...cache,rom:'wrong'},hash),/incompatible/);
console.log('REFERENCE_CACHE_V043666_PASS decoder=identical v65=accepted wrong_rom=rejected fake=rejected');
