// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('../forja65-core'),IO=require('../tools/project-io');
assert.match(F.VERSION,/^0\.4\.(?:2[6-9]|3[0-9])(?:\.[0-9]+)?-[a-z0-9-]+$/);
for(const v of ['0.4.25-brr-arithmetic','0.4.24-audio-key-timing','0.4.19-crossfeed-multigame'])assert.equal(IO.isAuditedCacheVersion(v),false,v);
for(const v of ['0.4.23-unknown','0.4.25-arbitrary','0.3.97-tetris-hardware'])assert.equal(IO.isAuditedCacheVersion(v),false,v);
const rom=F.loadRom(F.makeSyntheticRom(),'cache-unified.sfc'),a=F.analyze(rom,384),hash=F.romFingerprint(rom);
for(const v of ['0.4.25-brr-arithmetic','0.4.24-audio-key-timing','0.4.19-crossfeed-multigame']){
 const cache={...IO.makeCfgCache(a,hash),version:v};
 assert.throws(()=>IO.mergeCfgCoverage(F.analyze(rom,384),cache,hash),/cache incompatible/);
 assert.throws(()=>IO.mergeCfgCoverage(F.analyze(rom,384),{...cache,rom:'wrong-rom'},hash),/cache incompatible/);
}
for(const name of ['VERSION','VERSION.txt'])assert.equal(fs.readFileSync(path.join(__dirname,'..',name),'utf8').trim(),F.VERSION);
console.log('UNIFIED_CACHE_V026_PASS new_CFG_disallows_stale_predecessors=3 wrong_rom=rejected');
