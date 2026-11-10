// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
"use strict";
const assert=require('node:assert/strict');
const F=require('../forja65-core'),IO=require('../tools/project-io');
assert.match(F.VERSION,/^0\.4\.(?:2[5-9]|3[0-9])(?:\.[0-9]+)?-[a-z0-9-]+$/);
assert.equal(IO.isAuditedCacheVersion('0.4.24-audio-key-timing'),false); // CFG reset-vector decoding changed in 0.4.29
assert.equal(IO.isAuditedCacheVersion('0.4.23-unknown'),false);
const rom=F.loadRom(F.makeSyntheticRom(),'cache.sfc'),a=F.analyze(rom,384),hash=F.romFingerprint(rom);
const cache={...IO.makeCfgCache(a,hash),version:F.VERSION};
const merged=IO.mergeCfgCoverage(F.analyze(rom,384),cache,hash);
assert.ok(merged.retained>=0);
assert.throws(()=>IO.mergeCfgCoverage(F.analyze(rom,384),{...cache,version:'0.4.24-audio-key-timing'},hash),/cache incompatible/);
assert.throws(()=>IO.mergeCfgCoverage(F.analyze(rom,384),{...cache,rom:'bad'},hash),/cache incompatible/);
assert.equal(require('node:fs').readFileSync(require('node:path').join(__dirname,'../VERSION'),'utf8').trim(),F.VERSION);
assert.equal(require('node:fs').readFileSync(require('node:path').join(__dirname,'../VERSION.txt'),'utf8').trim(),F.VERSION);
console.log('BRR_CACHE_VERSION_V025_PASS');
