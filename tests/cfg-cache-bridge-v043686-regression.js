// Historical supplied .86 proof; current cache graph is checked separately in crossfeed-combined.
'use strict';
// Only the observed v18->v17->v16 branch is added; the v64 boundary stays closed.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const C=require('../crossfeed-historico/v043686-pendencias/forja65-core'),IO=require('../crossfeed-historico/v043686-pendencias/tools/project-io');
const root=path.resolve(__dirname,'../crossfeed-historico/v043686-pendencias'),digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function sourceAudit(file){
 const s=fs.readFileSync(file,'utf8'),a=s.indexOf('function hex('),b=s.indexOf('function cppHex(');
 assert(a>=0&&b>a,'decoder boundaries must exist');
 assert.equal(digest(s.slice(a,b)),'e230d3c3223e2ad3e356276ec3af69d844264349972604d036166f750ecb8005','audit invalidated by changed CFG');
 const context={};vm.runInNewContext(s,context);
 // All analysis helpers (including knowledge normalization) and the mapping enum
 // are outside that region, so pin them independently as decoder dependencies.
 assert.equal(digest(s.slice(0,s.indexOf('})(typeof globalThis'))),'a54ecf7e4ee3bd9cf55306cc5b5a34ea7c7bc9da8f8b100e11a722170d593a8f');
 assert.equal(s.match(/const MAP=.*;/)[0],"const MAP={UNKNOWN:'Unknown',LOROM:'LoROM',HIROM:'HiROM',EXHIROM:'ExHiROM'};");
 return context.Forja65Core;
}
sourceAudit(path.join(root,'forja65-core.js'));
for(const n of ['v043616','v043617','v043618']){
 const old=sourceAudit(path.join(__dirname,'../crossfeed-historico',n,'forja65-core.js'));
 assert(IO.isAuditedCacheVersion(old.VERSION),`audited source rejected: ${old.VERSION}`);
 for(const bytes0 of [[0x18,0xfb,0xc2,0x30,0xa9,0x34,0x12,0x60],[0x20,0x00,0x81,0xdb],[0x22,0x00,0x81,0x00,0xdb],[0xf4,0xcd,0xab,0x60]]){
  const bytes=C.makeSyntheticRom();bytes.set(bytes0);bytes.set([0xa9,0x17,0x60],0x100);
  const r=C.loadRom(bytes),prior=old.analyze(old.loadRom(bytes),256),a=C.analyze(r,256),hash=C.romFingerprint(r);
  assert.equal(JSON.stringify(prior.functions),JSON.stringify(a.functions),'CPU state/edges differ');
  const cache={...IO.makeCfgCache(prior,hash),version:old.VERSION};
  const merged=IO.mergeCfgCoverage(C.analyze(r,64),cache,hash).a;
  assert(C.generateProject(r,merged)['src/runtime.hpp'].includes('popLongReturn'),'regenerate current runtime');
  assert.throws(()=>IO.mergeCfgCoverage(a,{...cache,rom:'wrong-rom'},hash),/incompatible/);
  assert.throws(()=>IO.mergeCfgCoverage(a,{...cache,version:old.VERSION+'-fake'},hash),/incompatible/);
 }
}
for(const bad of ['0.4.36.15-unknown','0.4.36.2-dkc3-ppu-audit','0.4.33-ppu-mode7-latch','0.4.36.64-fake','0.3.67-stack-evidence-ppu-brightness'])assert.equal(IO.isAuditedCacheVersion(bad),false,bad);
assert.equal(IO.isAuditedCacheVersion('0.4.36.18-hardware-differential','0.4.36.64-ppu-oam-shared-byte-cursor'),false,'do not invent an unaudited gap');
assert.equal(IO.isAuditedCacheVersion('0.4.36.18-hardware-differential','0.4.36.87-future'),false,'future versions inherit no edge');
console.log('CFG_CACHE_BRIDGE_V043686_PASS source_pinned=4 historical_analyses=12 wrong_rom_and_fake=rejected gap_closed=1');
