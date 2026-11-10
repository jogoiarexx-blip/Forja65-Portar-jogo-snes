'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core.js');
const {makeCfgCache,mergeCfgCoverage,isAuditedCacheVersion}=require('../tools/project-io.js');
const rom=C.loadRom(C.makeSyntheticRom(),'fixture.sfc');
const hash=C.romFingerprint(rom);
// Explicit, audited immediate predecessor. Do not weaken production cache checks.
const predecessors={
 '0.3.97-tetris-hardware':'0.3.96-rom-indexed-vector-writers',
 '0.3.96-rom-indexed-vector-writers':'0.3.95-windows-capture-cleanup',
 '0.3.95-windows-capture-cleanup':'0.3.94-observed-callback-state',
 '0.3.94-observed-callback-state':'0.3.93-stack-return-lifetime',
 '0.3.93-stack-return-lifetime':'0.3.92-ppu-color-hdma-obj-fastpath',
 '0.3.92-ppu-color-hdma-obj-fastpath':'0.3.91-bg-obj-raster-provenance',
 '0.3.91-bg-obj-raster-provenance':'0.3.90-scanline-raster-provenance',
 '0.3.90-scanline-raster-provenance':'0.3.89-oam-order-pixel-provenance',

 '0.3.89-oam-order-pixel-provenance':'0.3.88-obj-assembly-diagnostics',
 '0.3.88-obj-assembly-diagnostics':'0.3.87-oam-vblank-reload',
 '0.3.87-oam-vblank-reload':'0.3.86-dma-provenance',
 '0.3.86-dma-provenance':'0.3.85-obj-slot-evidence',
 '0.3.85-obj-slot-evidence':'0.3.84-rom-tiny-indirect-leaves',
 '0.3.84-rom-tiny-indirect-leaves':'0.3.83-transactional-crash-learning',
 '0.3.83-transactional-crash-learning':'0.3.82-isolated-replay-sram',
 '0.3.82-isolated-replay-sram':'0.3.81-obj-input-probe',
 '0.3.81-obj-input-probe':'0.3.80-obj-bank-renderer',
 '0.3.80-obj-bank-renderer':'0.3.79-replay-input-ownership',
 '0.3.79-replay-input-ownership':'0.3.78-bounded-flow-peer-budget',
 '0.3.78-bounded-flow-peer-budget':'0.3.77-pending-flow-peer-frontier',
 '0.3.77-pending-flow-peer-frontier':'0.3.76-uncovered-runtime-priority',
 '0.3.76-uncovered-runtime-priority':'0.3.75-prioritized-flow-table-seeds',
 '0.3.75-prioritized-flow-table-seeds':'0.3.74-ctest-target-completeness',
 '0.3.74-ctest-target-completeness':'0.3.73-selective-shard-compile',
 '0.3.73-selective-shard-compile':'0.3.72-incremental-convergence-ppu-audit',
 '0.3.72-incremental-convergence-ppu-audit':'0.3.71-stack-converge-guard',
 '0.3.71-stack-converge-guard':'0.3.70-guarded-cfg-ppu-compact',
 '0.3.70-guarded-cfg-ppu-compact':'0.3.69-guarded-cfg-ppu-headless',
 '0.3.69-guarded-cfg-ppu-headless':'0.3.68-guarded-cfg-ppu-crossfeed'
};
const predecessor=predecessors[C.VERSION];
const a=C.analyze(rom,350);
// An un-audited unified release must NOT quietly inherit the predecessor map
// from a historical 0.3.x branch. Verify strict rejection instead.
if(!predecessor){
  assert.equal(isAuditedCacheVersion('0.3.97-tetris-hardware'),false);
  const stale={...makeCfgCache(a,hash),version:'0.3.97-tetris-hardware'};
  assert.throws(()=>mergeCfgCoverage(C.analyze(rom,350),stale,hash),/incompatible/);
  assert.throws(()=>mergeCfgCoverage(C.analyze(rom,350),{...stale,version:'FAKE_VERSION'},hash),/incompatible/);
  assert.equal(mergeCfgCoverage(C.analyze(rom,350),makeCfgCache(a,hash),hash).a.decoded,a.decoded);
  console.log('CFG_CACHE_STRICT_UNAUDITED_VERSION_REJECTION_PASS '+C.VERSION);
}else{
  const cache={...makeCfgCache(a,hash),version:predecessor};
  const merged=mergeCfgCoverage(C.analyze(rom,350),cache,hash);
  assert.equal(merged.a.decoded,a.decoded);
  assert.throws(()=>mergeCfgCoverage(C.analyze(rom,350),cache,'0000000000000000'),/incompatible/);
  assert.throws(()=>mergeCfgCoverage(C.analyze(rom,350),{...cache,version:'0.3.67-stack-evidence-ppu-brightness'},hash),/incompatible/);
  const older={...cache,version:predecessors[predecessor]};
  assert.ok(isAuditedCacheVersion(older.version));
  assert.equal(mergeCfgCoverage(C.analyze(rom,350),older,hash).a.decoded,a.decoded);
  assert.equal(isAuditedCacheVersion('0.3.67-stack-evidence-ppu-brightness'),false);
  assert.equal(isAuditedCacheVersion('FAKE_VERSION'),false);
  console.log('CFG_CACHE_V0369_COMPATIBLE_PREDECESSOR_PASS');
}
