'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core'),old=require('../crossfeed-historico/v0429/forja65-core'),IO=require('../tools/project-io');
// Permit patch-level versions (0.4.36.2) without weakening cache provenance.
assert(/^0\.4\.(?:3[0-9])(?:\.[0-9]+)?-[a-z0-9-]+$/.test(C.VERSION));
assert.equal(old.VERSION,'0.4.29-crossfeed-6-branches');
assert.equal(IO.isAuditedCacheVersion(old.VERSION),false,'CPU/CFG changes require fresh decoding');
for(const code of [[0x18,0xFB,0xC2,0x30,0xA9,0x34,0x12,0x60],[0x22,0x00,0x81,0x00,0xDB],[0x5C,0x00,0x81,0x00]]){
 const bytes=C.makeSyntheticRom();bytes.set(code);bytes.set([0xA9,0x17,0x6B],0x100);
 const rom=C.loadRom(bytes),prior=old.analyze(old.loadRom(bytes),512),current=C.analyze(rom,512),hash=C.romFingerprint(rom);
 const normalize=functions=>functions.map(({frontierDiagnostics,...f})=>({...f,instructions:f.instructions.map(({rieIndirect,...i})=>i)}));
 assert.deepEqual(normalize(current.functions),normalize(prior.functions),'decoded states, bytes, calls and edges must remain equivalent');
 const cache={...IO.makeCfgCache(prior,hash),version:old.VERSION};
 assert.throws(()=>IO.mergeCfgCoverage(C.analyze(rom,64),cache,hash),/incompatible/);
 const merged=current;
 const pcs=new Set(merged.functions.flatMap(f=>f.instructions.map(i=>i.pc)));
 for(const f of prior.functions)for(const i of f.instructions)assert(pcs.has(i.pc));
 assert(C.generateProject(rom,merged)['src/dispatch.cpp'].includes('forja65_try_wram_transfer'));
 assert.throws(()=>IO.mergeCfgCoverage(current,cache,'wrong-rom'),/incompatible/);
 assert.throws(()=>IO.mergeCfgCoverage(current,{...cache,version:'FAKE_VERSION'},hash),/incompatible/);
}
assert.equal(IO.isAuditedCacheVersion('0.3.97-tetris-hardware'),false);
console.log('CFG_CACHE_V0430_PASS historic_cache=rejected sampled_programs=equivalent wrong_rom=reject unaudited=reject regenerated_dispatch=0430');
