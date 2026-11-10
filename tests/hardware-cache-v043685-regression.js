// Historical supplied .86 proof; current cache graph is checked separately in crossfeed-combined.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const F=require('../crossfeed-historico/v043686-pendencias/forja65-core'),IO=require('../crossfeed-historico/v043686-pendencias/tools/project-io');
const s=fs.readFileSync(require.resolve('../crossfeed-historico/v043686-pendencias/forja65-core'),'utf8');
assert.equal(crypto.createHash('sha256').update(s.slice(s.indexOf('function hex('),s.indexOf('function cppHex('))).digest('hex'),'e230d3c3223e2ad3e356276ec3af69d844264349972604d036166f750ecb8005');
assert.equal(IO.isAuditedCacheVersion('0.4.36.85-spc-dsp-dma-irq-hardware'),true);
assert.equal(IO.isAuditedCacheVersion('0.4.36.84-crossfeed-v67-v83'),true);
assert.equal(IO.isAuditedCacheVersion('0.4.36.84-invented'),false);
assert.equal(fs.readFileSync(require('path').join(__dirname,'../crossfeed-historico/v043686-pendencias/VERSION'),'utf8').trim(),F.VERSION);
console.log('HARDWARE_CACHE_V043685_PASS decoder=pinned v84=accepted fake=rejected version=consistent');
