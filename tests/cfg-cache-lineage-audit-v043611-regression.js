'use strict';
// A permanent fail-closed regression for the crossfeed compatibility edge.
// This is not an assertion that historical runtime PPU/DMA/audio was equal:
// only the ROM decoder/CPU CFG discovery can be reused. C++ is regenerated.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Active=require('../forja65-core.js');
const Current=require('../crossfeed-historico/v043615/forja65-core.js');
const V0429=require('../crossfeed-historico/v0429/forja65-core.js');
const V0433=require('../crossfeed-historico/v0433/forja65-core.js');
const IO=require('../tools/project-io.js');
const root=path.resolve(__dirname,'..');
const EXPECTED_ENGINE_SHA256='9b45481315faf5d8e07cdaf368b58c328aeb229cbb5120d800c07284e85e10aa';
const BASELINE_ENGINE_SHA256='db3d2fe17290dc181569016b42fc3ec795ea5b3840b0013f67e8bda06049a7ad';
// The same SHA was independently measured on BOTH v0.4.36 Biker and Bomber
// release inputs, and archived v0.4.29/v0.4.33 (13 October 2026).
function engineRegion(file){
 const source=fs.readFileSync(file,'utf8');
 const start=source.indexOf('function hex('),end=source.indexOf('function cppHex(');
 assert(start>=0&&end>start,'invalid core source or moved CFG boundaries');
 return source.slice(start,end);
}
const currentRegion=engineRegion(path.join(root,'crossfeed-historico/v043615/forja65-core.js'));
assert.equal(crypto.createHash('sha256').update(currentRegion).digest('hex'),EXPECTED_ENGINE_SHA256,
 'CFG engine changed: do not retain audited cache lineage without a NEW code audit');
// v0.4.36.14 adds an opt-in internal worklist ordering *only* for supervised
// migration. Remove exactly those audited edits and prove the ordinary decoder
// remains byte-identical to both predecessor engines. Any other change fails.
function ordinaryEngine(region){
 const rules=[
  ['observedDispatch=null,priorityStateKeys=null){','observedDispatch=null){'],
  [
   `    // Only an explicitly requested *migration* pass may reorder the active
    // decoder's existing worklist. It cannot add a state, branch or edge.
    // The old cache supplies a comparison key, never CPU state or code.
    let prioritized=-1;
    if(priorityStateKeys?.size)for(let j=work.length-1;j>=0;j--){
      const q=work[j];
      if(priorityStateKeys.has(nodeKey(q.pc,q.state,q.stack))){prioritized=j;break;}
    }
    const cur=prioritized<0?work.pop():work.splice(prioritized,1)[0],pc=cur.pc&0xFFFFFF,key=nodeKey(pc,cur.state,cur.stack);`,
   `    const cur=work.pop(),pc=cur.pc&0xFFFFFF,key=nodeKey(pc,cur.state,cur.stack);`
  ],
  ['opts.discoverySeeds||[],opts.focusFrontiers||null);','opts.discoverySeeds||[]);'],
  ['knowledgeSeedLimit=1024,discoverySeeds=[],focusFrontiers=null){','knowledgeSeedLimit=1024,discoverySeeds=[]){'],
  ['q.state,summaries,dispatchHints,observedDispatch,focusFrontiers?.get(fk));','q.state,summaries,dispatchHints,observedDispatch);']
 ];
 for(const [modern,prior] of rules){
  assert(region.includes(modern),'Cannot normalize audited opt-in CFG delta');
  region=region.replace(modern,prior);
 }
 return region;
}
const ordinary=ordinaryEngine(currentRegion);
assert.equal(crypto.createHash('sha256').update(ordinary).digest('hex'),BASELINE_ENGINE_SHA256,
 'Ordinary CFG decoder differs from the historically audited engine');
for(const older of ['v0429','v0433']){
 assert.equal(engineRegion(path.join(root,'crossfeed-historico',older,'forja65-core.js')),ordinary,
  `${older} CFG engine differs: invalidate compatibility ancestry`);
}
assert.equal(Current.VERSION,'0.4.36.2-dkc3-ppu-audit');
assert.equal(V0429.VERSION,'0.4.29-crossfeed-6-branches');
assert.equal(V0433.VERSION,'0.4.33-ppu-mode7-latch');
for(const old of ['0.4.36-dma-wram-sram','0.4.35-pcm-dsp-fir-noise',
                  '0.4.34-ppu-mode7-math','0.4.33-ppu-mode7-latch',
                  '0.4.29-crossfeed-6-branches']){
 assert(IO.isAuditedCacheVersion(old,Current.VERSION),`audited ancestor rejected: ${old}`);
}
for(const unwanted of ['0.4.36.3-future','0.4.36.2-other','0.4.35-FAKE',
                       '0.4.28-smw-wram-resume','0.4.29-monotonic-cfg-growth',
                       '0.4.24-audio-key-timing',
                       '0.3.97-tetris-hardware','evil']){
 assert.equal(IO.isAuditedCacheVersion(unwanted),false,`unaudited ancestor accepted: ${unwanted}`);
}
// A future core version may never inherit the chain implicitly.
assert.equal(IO.isAuditedCacheVersion('0.4.36.2-dkc3-ppu-audit','0.4.36.3-future'),false);
assert.equal(IO.isAuditedCacheVersion(Current.VERSION),false);
assert.equal(IO.isAuditedCacheVersion(Active.VERSION),true);
let verified=0;
const programs=[
 [0x18,0xFB,0xC2,0x30,0xA9,0x34,0x12,0x60],
 [0x22,0x00,0x81,0x00,0xDB],
 [0x5C,0x00,0x81,0x00],
 [0x20,0x00,0x81,0x6B],
 [0xA9,0x01,0x69,0x02,0xF0,0x03,0x80,0x01,0xEA,0x60],
];
for(const opcodes of programs){
 const bytes=Current.makeSyntheticRom();bytes.set(opcodes);bytes.set([0xA9,0x17,0x6B],0x100);
 const rom=Current.loadRom(bytes),hash=Current.romFingerprint(rom);
 const newer=Current.analyze(rom,256);
 for(const ancestor of [V0429,V0433]){
  const old=ancestor.analyze(ancestor.loadRom(bytes),256);
  assert.deepEqual(newer.functions,old.functions,'older CFG discovery differs from current');
  const inherited={...IO.makeCfgCache(old,hash),version:ancestor.VERSION};
  assert.equal(IO.isAuditedCacheVersion(ancestor.VERSION),false,'changed decoder must reject historic cache');
  assert.throws(()=>IO.mergeCfgCoverage(Active.analyze(rom,64),inherited,hash,32768),/incompatible/);
  const refreshed=Active.analyze(rom,256);
  // Regenerate from the active Forja core; never ship cached C++ from another release.
  const files=Active.generateProject(rom,refreshed);
  assert(files['src/dispatch.cpp'].includes('forja65_try_wram_transfer'));
  assert(files['src/runtime.hpp'].includes('sramSaveError'));
  assert.throws(()=>IO.mergeCfgCoverage(Current.analyze(rom,64),inherited,'another-rom'),/incompatible/);
  assert.throws(()=>IO.mergeCfgCoverage(Current.analyze(rom,64),{...inherited,version:'0.4.35-fake'},hash),/incompatible/);
  verified++;
 }
}
console.log(`CFG_CACHE_LINEAGE_AUDIT_PASS sha256=${EXPECTED_ENGINE_SHA256.slice(0,12)} rejected_stale_caches=${verified} strict_guards=pass`);
