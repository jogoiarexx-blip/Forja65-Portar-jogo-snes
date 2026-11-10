// Historical supplied .86 proof; current cache graph is checked separately in crossfeed-combined.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const F=require('../crossfeed-historico/v043686-pendencias/forja65-core'),IO=require('../crossfeed-historico/v043686-pendencias/tools/project-io');
const s=fs.readFileSync(require.resolve('../crossfeed-historico/v043686-pendencias/forja65-core'),'utf8');
assert.equal(crypto.createHash('sha256').update(s.slice(s.indexOf('function hex('),s.indexOf('function cppHex('))).digest('hex'),'e230d3c3223e2ad3e356276ec3af69d844264349972604d036166f750ecb8005');
assert.equal(F.VERSION,'0.4.36.86-pending-regressions-fixed');
const r=F.loadRom(F.makeSyntheticRom()),a=F.analyze(r,128),hash=F.romFingerprint(r);
for(const v of ['0.4.36.67-spc-dsp-hdma-irq-reference','0.4.36.83-dsp-envelope-output-scaling','0.4.36.66-crossfeed-ppu1-trace-build','0.4.36.65-ppu1-open-bus-status','0.4.36.66-open-source-hardware']){
 assert.equal(IO.isAuditedCacheVersion(v),true,v);
 const cache={...IO.makeCfgCache(a,hash),version:v};IO.mergeCfgCoverage(a,cache,hash);
 assert.throws(()=>IO.mergeCfgCoverage(a,{...cache,rom:'wrong'},hash),/incompatible/);
 assert.equal(IO.isAuditedCacheVersion(v+'-fake'),false);
}
assert.equal(IO.isAuditedCacheVersion('0.4.36.82-unverified'),false);
console.log('CROSSFEED_CACHE_V043684_PASS both_branches=accepted fake_and_wrong_rom=rejected');
