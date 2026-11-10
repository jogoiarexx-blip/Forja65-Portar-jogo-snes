'use strict';
const fs=require('fs'),path=require('path'),C=require('../forja65-core'),Memory=require('./analysis-memory'),InternalReplay=require('../analysis/internal-replay'),Vault=require('./knowledge-vault');
function hintKey(h){return [h.rom,h.target,h.from,h.kind,h.state.emulation,h.state.m8,h.state.x8,h.state.carry].join('|');}
function readOptional(file){return fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';}
function writeFiles(out,files){fs.mkdirSync(out,{recursive:true});const changed=[];for(const [n,v]of Object.entries(files)){const p=path.join(out,n),bytes=typeof v==='string'?Buffer.from(v):Buffer.from(v);if(fs.existsSync(p)&&fs.readFileSync(p).equals(bytes))continue;fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);changed.push(n);}return changed;}
function refreshManifest(project,changed){const file=path.join(project,'forja65-build-manifest.txt'),lines=fs.readFileSync(file,'utf8').trimEnd().split('\n');for(const [name,value]of Object.entries(changed)){const bytes=typeof value==='string'?Buffer.from(value):Buffer.from(value),line='file='+name+' size='+bytes.length+' fnv1a64='+C.fnv1a64Bytes(bytes),i=lines.findIndex(l=>l.startsWith('file='+name+' size='));if(i>=0)lines[i]=line;else lines.push(line);}writeFiles(project,{'forja65-build-manifest.txt':lines.join('\n')+'\n'});}
// Same-ROM, same-version monotonic CFG cache. Every retained routine was
// decoded independently from real ROM bytes by this exact Forja65 version.
// Never invent edges, return targets, or CPU states to make a missing label pass.
const CACHE_SCHEMA='forja65.cfg-coverage-cache.v1';
// v0.3.66 changes output instrumentation only, not the decoder/CFG algorithm.
// Permit only the audited immediate predecessor's decoded ROM functions.
const OUTPUT_ONLY_COMPATIBLE_PREDECESSORS=Object.freeze({
 // Audited v112..v116: core sources match byte-for-byte except VERSION literal.
 // These releases only extend persistent knowledge, UI, runtime evidence and
 // regression advice; existing decoded CFG entries are safe to recheck and
 // regenerate as output in v116. See tests/recovery-advisor-compat-v0436116.js.
 // REV202 (.118) changes decodeCfgFunction (inline pointer tables after JSL/JSR)
 // and issue classification: caches from .117 and earlier are NOT reused.
 '0.4.36.117-legacy-port-archaeology':'0.4.36.116-recovery-advisor',
 '0.4.36.116-recovery-advisor':'0.4.36.115-regression-intelligence',
 '0.4.36.115-regression-intelligence':'0.4.36.114-runtime-evidence-vault',
 '0.4.36.114-runtime-evidence-vault':'0.4.36.113-ui-repair-vault',
 '0.4.36.113-ui-repair-vault':['0.4.36.112-knowledge-vault','0.4.36.107-rie-indexed-jsr'],
 '0.4.36.112-knowledge-vault':'0.4.36.107-rie-indexed-jsr',
 // REV136 audit (tests/cache-chain-v0436136-regression.js): the archived .103 core
 // (crossfeed-historico/v0436103-pre-crlf) and the active core have byte-identical
 // decodeOne and decodeCfgFunction; the analysis differs only in seed priority/
 // speculative-cascade suppression (REV125) and report metadata. Cached .103 CFG
 // entries are therefore re-checked and re-emitted, never trusted as new semantics.
 '0.4.36.107-rie-indexed-jsr':'0.4.36.103-rie-crossfeed',
 '0.4.36.103-rie-crossfeed':['0.4.36.98-rie-internal-replay','0.4.36.99-rie-observed-jsr-verified'],
 '0.4.36.99-rie-observed-jsr-verified':'0.4.36.98-rie-indexed-target-safe',
 '0.4.36.98-rie-indexed-target-safe':'0.4.36.97-rie-indexed-trace',
 '0.4.36.97-rie-indexed-trace':'0.4.36.96-rie-indirect-long',
 // Scheduling-only replay; active opcode/state/runtime/emitter semantics preserved.
 '0.4.36.98-rie-internal-replay':'0.4.36.97-rie-persistent-analysis',
 // Persistent memoization wraps unchanged analysis; opcode/runtime/emitter preserved.
 '0.4.36.97-rie-persistent-analysis':'0.4.36.96-rie-indirect-evidence',
 // Additional indirect evidence/edges; opcode/runtime/emitter semantics audited against .95.
 '0.4.36.96-rie-indirect-evidence':'0.4.36.95-rie-cfg-global',
 // CFG Global adds roots/frontiers; decoder and emitted instruction semantics preserved.
 '0.4.36.95-rie-cfg-global':'0.4.36.94-rie-rom-inventory',
 // RIE inventory observes only. Byte-identical decoder/CFG audit in v043694 tests.
 '0.4.36.94-rie-rom-inventory':'0.4.36.93-bomberman-timed-callback-width',
 // v84 union: all three source decoder/CFG regions match pinned e230d3c3...
 '0.4.36.84-crossfeed-v67-v83':['0.4.36.67-spc-dsp-hdma-irq-reference','0.4.36.83-dsp-envelope-output-scaling','0.4.36.66-crossfeed-ppu1-trace-build'],
 '0.4.36.66-crossfeed-ppu1-trace-build':'0.4.36.65-ppu1-open-bus-status',
 '0.4.36.65-ppu1-open-bus-status':'0.4.36.64-ppu-oam-shared-byte-cursor',
 // v67 changes hardware runtime only; CPU/CFG hash remains pinned.
 '0.4.36.67-spc-dsp-hdma-irq-reference':'0.4.36.66-open-source-hardware',
 // Hardware runtime fixes only; CPU/CFG hash verified in v66 regression.
 '0.4.36.66-open-source-hardware':'0.4.36.65-trace-disabled-build-fix',
 // Trace-disabled declaration/build fix only; decoder/CFG hash pinned in v65 regression.
 '0.4.36.65-trace-disabled-build-fix':'0.4.36.64-ppu-oam-shared-byte-cursor',
 // RMW word write order changes output/runtime only; static CFG identical to v21.
 '0.4.36.22-rmw-bus-order':'0.4.36.21-blockmove-index-cycles',
 // Block-move runtime/output only; static decoder/CFG byte-identical to v20.
 '0.4.36.21-blockmove-index-cycles':'0.4.36.20-decimal-adc-overflow',
 // ADC decimal V runtime only; decoder/CFG byte-identical to v19.
 '0.4.36.20-decimal-adc-overflow':'0.4.36.19-cpu-stack-boundaries',
 // Stack instruction output/runtime only; decoder/CFG audited byte-identical.
 '0.4.36.19-cpu-stack-boundaries':'0.4.36.18-hardware-differential',
 // Runtime-only hardware precision changes; static decoder/CFG identical to v17.
 '0.4.36.18-hardware-differential':'0.4.36.17-iterative-cpu-calls',
 // v0.4.36.17 changes call emission/runtime only; decoder/CFG bytes are audited against v16.
 '0.4.36.17-iterative-cpu-calls':'0.4.36.16-cfg-cpu-addressing',
 // Audited crossfeed 13/10/2026: the entire JS ROM mapping, decoder and CFG
 // analysis region (function hex -> before function cppHex) is byte-identical
 // in the current v0.4.36.2 core, the shipped v0.4.36 Biker/Bomber cores,
 // and the archived v0.4.29/v0.4.33 cores. Emitted C++ is regenerated.
 // See tests/cfg-cache-lineage-audit-v043611-regression.js, including a
 // pinned digest so this grant FAILS CLOSED if a future core changes CFG.
 '0.4.36.2-dkc3-ppu-audit':'0.4.36-dma-wram-sram',
 // v0.4.36 changes DMA/HDMA bus handling and SRAM persistence only.
 // Decoder, CFG and CPU code emission were compared with v0.4.35.
 '0.4.36-dma-wram-sram':'0.4.35-pcm-dsp-fir-noise',
 // v0.4.35 changes host PCM and DSP runtime; pre-runtime CPU/CFG code
 // was compared with the attached v0.4.34.3 (same v0.4.34 core identifier).
 '0.4.35-pcm-dsp-fir-noise':'0.4.34-ppu-mode7-math',
 // CPU/APU event order and DMA cost only; ROM decoder and CFG are unchanged.
 '0.4.34-ppu-mode7-math':'0.4.33-ppu-mode7-latch',
 '0.4.33-ppu-mode7-latch':'0.4.32-cpu-dma-order',
 '0.4.32-cpu-dma-order':'0.4.31-spc-profile',
 // SPC runtime/profile only; ROM CPU decoder and CFG remain unchanged.
 '0.4.31-spc-profile':'0.4.30-cfg-wram',
 // v0.4.30 changes WRAM runtime/dispatcher only; ROM decoding and CFG are unchanged.
 '0.4.30-cfg-wram':'0.4.29-crossfeed-6-branches',
 // ROM opcode decoding is unchanged; WRAM store execution and cache budgeting only.
 '0.4.28-smw-wram-resume':'0.4.27-unified-wram-video',
 // Opt-in WRAM instrumentation only; CPU/CFG decoder and emission unchanged.
 '0.4.27-unified-wram-video':'0.4.26-unified-spc-dsp',
 // Unified output-only merge; CPU/CFG source compared between all supplied branches.
 '0.4.26-unified-spc-dsp':'0.4.25-brr-arithmetic',
 '0.4.24-audio-key-timing':'0.4.19-crossfeed-multigame',
 // v0.4.25 changes DSP BRR arithmetic only. Reuse v0.4.24 decoded CPU/CFG,
 // but always regenerate C++ so cached projects receive the corrected DSP.
 '0.4.25-brr-arithmetic':'0.4.24-audio-key-timing',
 // v97 changes runtime CPU arithmetic, PPU/SPC/DSP and ROM lookup only; opcode/CFG decoding and cached edges are unchanged.
 '0.3.97-tetris-hardware':'0.3.96-rom-indexed-vector-writers',
 // v96 adds ROM-backed candidate edges; prior opcode/state coverage remains valid.
 '0.3.96-rom-indexed-vector-writers':'0.3.95-windows-capture-cleanup',
 // v95 changes diagnostic test file lifetimes and build output only; CPU coverage is unchanged.
 '0.3.95-windows-capture-cleanup':'0.3.94-observed-callback-state',
 // v94 enriches observed edges/PEA continuations. Individual opcode decoding and emitter
 // are unchanged; v93 coverage remains a guarded partial set, with callers reanalyzed.
 '0.3.94-observed-callback-state':'0.3.93-stack-return-lifetime',
 // v93 retains decoded ROM/CFG entries; all C++ is regenerated with stack-lifetime tracking.
 '0.3.93-stack-return-lifetime':'0.3.92-ppu-color-hdma-obj-fastpath',
 '0.3.92-ppu-color-hdma-obj-fastpath':'0.3.91-bg-obj-raster-provenance',
 '0.3.91-bg-obj-raster-provenance':'0.3.90-scanline-raster-provenance',
 '0.3.90-scanline-raster-provenance':'0.3.89-oam-order-pixel-provenance',

 // v0.3.86 adds read-only DMA transfer provenance; decoder and CPU CFG unchanged.
 '0.3.89-oam-order-pixel-provenance':'0.3.88-obj-assembly-diagnostics',
 '0.3.88-obj-assembly-diagnostics':'0.3.87-oam-vblank-reload',
 '0.3.87-oam-vblank-reload':'0.3.86-dma-provenance',
 '0.3.86-dma-provenance':'0.3.85-obj-slot-evidence',
 // v0.3.85 adds opt-in OBJ slot telemetry only; CPU decoding and C++ CFG emission unchanged.
 '0.3.85-obj-slot-evidence':'0.3.84-rom-tiny-indirect-leaves',
 // v0.3.84 only adds ROM-guarded speculative decode seeds; cached opcodes/state and emitter are unchanged.
 '0.3.84-rom-tiny-indirect-leaves':'0.3.83-transactional-crash-learning',
 // v0.3.83 changes crash-learning transaction semantics only; CPU CFG is identical.
 '0.3.83-transactional-crash-learning':'0.3.82-isolated-replay-sram',
 // v0.3.82 changes SRAM path selection only; CPU decoder and CFG unchanged.
 '0.3.82-isolated-replay-sram':'0.3.81-obj-input-probe',
 // v0.3.81 changes the OBJ capture exporter, diagnostics and tests only; CFG is unchanged.
 '0.3.81-obj-input-probe':'0.3.80-obj-bank-renderer',
 // v0.3.80 changes OBJ renderer and test code only; CPU CFG is unchanged.
 '0.3.80-obj-bank-renderer':'0.3.79-replay-input-ownership',
 // v0.3.79 changes host polling ownership only; ROM decoding/CFG unchanged.
 '0.3.79-replay-input-ownership':'0.3.78-bounded-flow-peer-budget',
 // v0.3.78 bounds speculative discovery priority; decoding/emission unchanged.
 '0.3.78-bounded-flow-peer-budget':'0.3.77-pending-flow-peer-frontier',
 // v0.3.77 only reorders discovery; cached instruction decoding/emission is unchanged.
 '0.3.77-pending-flow-peer-frontier':'0.3.76-uncovered-runtime-priority',
 '0.3.68-guarded-cfg-ppu-crossfeed':'0.3.67-stack-evidence-ppu-brightness',
 // 0.3.69 alters headless termination and diagnostics; 65C816 CFG analysis is unchanged.
 '0.3.69-guarded-cfg-ppu-headless':'0.3.68-guarded-cfg-ppu-crossfeed',
 '0.3.70-guarded-cfg-ppu-compact':'0.3.69-guarded-cfg-ppu-headless',
 // 0.3.71 guards convergence's acceptance of computed returns, but the CFG decoder is unchanged.
 '0.3.71-stack-converge-guard':'0.3.70-guarded-cfg-ppu-compact',
 // v0.3.72 changes the convergence runner and its PPU audit, not ROM decoding.
 '0.3.72-incremental-convergence-ppu-audit':'0.3.71-stack-converge-guard',
 // v0.3.73 only adds opt-in C++ compilation flags; ROM decoder unchanged.
 '0.3.73-selective-shard-compile':'0.3.72-incremental-convergence-ppu-audit',
 // v0.3.74 only changes generated Windows build scripts; ROM decoding is unchanged.
 '0.3.74-ctest-target-completeness':'0.3.73-selective-shard-compile',
 // v0.3.75 reorders discovery seeds but does not change how already-decoded functions are emitted.
 '0.3.75-prioritized-flow-table-seeds':'0.3.74-ctest-target-completeness',
 // v0.3.76 reorders observed seeds using CPU-compatible cached coverage; decoder unchanged.
 '0.3.76-uncovered-runtime-priority':'0.3.75-prioritized-flow-table-seeds'
});
// A cache may be shared across a chain of versions only if *every* edge
// has been explicitly audited to leave CPU decoding and CFG emission intact.
// Avoid accepting arbitrary older caches or silently bypassing ROM fingerprints.
function isAuditedCacheVersion(candidate,current=C.VERSION){
 if(candidate===current)return true;
 const seen=new Set([current]),pending=[current];
 while(pending.length){
  const edge=OUTPUT_ONLY_COMPATIBLE_PREDECESSORS[pending.pop()];
  for(const version of (Array.isArray(edge)?edge:edge?[edge]:[])){
   // Stop only this path at the unaudited boundary; other branches remain valid.
   if(version==='0.3.67-stack-evidence-ppu-brightness'||seen.has(version))continue;
   if(version===candidate)return true;
   seen.add(version);pending.push(version);
  }
 }
 return false;
}
function makeCfgCache(a,hash){return {schema:CACHE_SCHEMA,rom:hash,version:C.VERSION,functions:a.functions,staticReturnTargets:a.staticReturnTargets||[],syntheticReturnTargets:a.syntheticReturnTargets||[],cfgFrontier:a.cfgFrontier||[],cfgFrontierContext:a.cfgFrontierContext||null,internalReplayContext:a.internalReplayContext||null};}
function mergeCfgCoverage(a,cache,hash,limit=32768){
 if(cache&&(cache.schema!==CACHE_SCHEMA||cache.rom!==hash||!isAuditedCacheVersion(cache.version)||!Array.isArray(cache.functions)))throw new Error('CFG coverage cache incompatible with ROM/version; refusing stale compilation coverage');
 return C.mergeCfgCoverageRecords(a,cache,hash,limit);
}
// analyzeOnce prepends observed seeds. Put pending observations last so
// already-cached routines cannot consume the discovery budget before them.
// Coverage includes CPU widths and carry, not merely an instruction address.
function prioritizeUncoveredHints(hints,cache){
 const coverage=new Map();
 for(const f of cache?.functions||[])for(const i of f.instructions||[]){
  const states=coverage.get(i.pc)||[];states.push(i.stateIn);coverage.set(i.pc,states);
 }
 const covered=h=> (coverage.get(h.target)||[]).some(st=>st&&
  st.emulation===h.state.emulation&&st.m8===h.state.m8&&st.x8===h.state.x8&&
  (st.carry===null||st.carry===h.state.carry));
 return [...hints.filter(covered).map(h=>({...h,cachedCoverage:true})),...hints.filter(h=>!covered(h)).map(h=>({...h,cachedCoverage:false}))];
}
// Revisit direct calls already decoded in the actual caller of a pending flow.
// These are static discovery candidates, not additional observed runtime hints.
function cachedCallerSeeds(hints,cache,rom=null){
 const sites=new Set(hints.filter(h=>!h.cachedCoverage&&h.from!==null).map(h=>h.from)),seeds=new Map();
 const hash=rom?C.romFingerprint(rom):null;
 // A literal JSL preserves E/M/X/C. Its observed destination therefore also
 // proves the CPU widths at the callsite, even when an earlier callback made
 // the cached caller state obsolete. Revisit that suffix in the actual state.
 if(rom)for(const h of hints){
  if(h.cachedCoverage||h.from===null||!['FLOW','STATE'].includes(h.kind)||h.rom!==hash)continue;
  let i;try{i=C.decodeOne(rom,h.from,{...h.state});}catch{continue;}
  if(i&&i.mnemonic==='JSL'&&i.operand===h.target)
   seeds.set(h.from+'|'+JSON.stringify(h.state),{start:h.from,state:{...h.state},entryName:'CACHED-CALLER'});
 }
 for(const f of cache?.functions||[])if(f.instructions.some(i=>sites.has(i.pc))){
  const indirect=f.instructions.some(i=>sites.has(i.pc)&&['JMP','JSR'].includes(i.mnemonic)&&['AbsoluteIndirect','AbsoluteIndirectLong','AbsoluteIndexedIndirectX'].includes(i.mode));
  if(indirect&&f.entryState)seeds.set(f.start+'|'+JSON.stringify(f.entryState),{start:f.start,state:f.entryState,entryName:'CACHED-CALLER'});
  for(const c of f.calls||[])if(c.state)seeds.set(c.target+'|'+JSON.stringify(c.state),{start:c.target,state:c.state,entryName:'CACHED-CALL'});
 }
 return [...seeds.values()];
}
// Retry discovery with a smaller budget; never evict cached coverage.
// In automatic mode only, grow the limit to fit proven, decoded variants.
// A retry is accepted only if every pending observation is actually decoded.
function analyzeWithinCacheLimit(rom,max,hints,opts,cache,hash,limit,analysisMemory=null,requiredHints=hints,autoMaxLimit=0){
 const pending=prioritizeUncoveredHints(requiredHints,cache).filter(h=>!h.cachedCoverage);
 const attempts=[];let budget=max,lastError,upper=max+1,lower=0,activeLimit=limit;
 const firstLimit=limit;
 function growLimit(error){
   if(!autoMaxLimit)return false;
   const match=/^CFG cache variant ceiling \((\d+) > \d+\)/.exec(error.message);
   if(!match)return false;
   const observed=Number(match[1]);
   if(!Number.isSafeInteger(observed)||observed>autoMaxLimit||observed<=activeLimit)return false;
   // Powers of two avoid repeated retries; the hard upper bound remains explicit.
   const proposed=Math.min(autoMaxLimit,2**Math.ceil(Math.log2(observed)));
   if(proposed<=activeLimit)return false;
   attempts.push({event:'cache-limit-auto-grow',from:activeLimit,to:proposed,requiredDistinct:observed});
   activeLimit=proposed;return true;
 }
 while(budget>=1){
  const {inventoryCache,...semanticOptions}=opts;
  const fresh=analysisMemory?analysisMemory.run({max:budget,hints,options:semanticOptions},()=>C.analyze(rom,budget,hints,opts)):C.analyze(rom,budget,hints,opts);
  try{
   let result;
   while(true){
    try{result=mergeCfgCoverage(fresh,cache,hash,activeLimit);break;}
    catch(error){if(!growLimit(error))throw error;}
   }
   if(cache&&prioritizeUncoveredHints(pending,result.a).some(h=>!h.cachedCoverage))
    throw new Error('CFG pending observation not decoded within the cache ceiling');
   attempts.push({budget,variants:result.a.instructionVariants,distinctVariants:result.a.cfgCacheUniqueInstructionVariants,accepted:true});
   return {...result,attempts,budget,cacheLimit:activeLimit,cacheLimitAutoGrew:activeLimit>firstLimit};
  }catch(error){
   const ceiling=error.message.startsWith('CFG cache variant ceiling');
   const missing=error.message.startsWith('CFG pending observation');
   if(!cache||(!ceiling&&!missing))throw error;
   lastError=error;attempts.push({budget,accepted:false,reason:error.message});
   if(ceiling)upper=budget;else lower=budget;
   if(upper-lower<=1)break;
   budget=Math.max(1,Math.floor((upper+lower)/2));
  }
 }
 throw lastError;
}
function generate({romPath,out,max=262144,hints='',profile,trace=null,knowledge=null,update=false,cacheLimit=null,discoverySeeds=[],focusFrontiers=null,globalCfg,globalCfgRounds,globalCfgBudget,indirectRie,persistentAnalysis,internalReplay,internalReplayBudget,knowledgeHome,useKnowledgeVault=true}){
 const romBytes=fs.readFileSync(romPath);
 const rom=C.loadRom(new Uint8Array(romBytes),path.basename(romPath)),hash=C.romFingerprint(rom),existing=fs.existsSync(out)&&fs.readdirSync(out).length>0;
 if(existing&&!update)throw new Error('Output already exists; choose another --out or use --update.');
 if(existing){for(const n of ['analysis.json','analysis/generation-options.json','profiles/game_config.json']){const file=path.join(out,n);if(fs.existsSync(file)){const meta=JSON.parse(fs.readFileSync(file,'utf8')),identity=meta.rom_fingerprint||meta.rom;if(identity&&identity!==hash)throw new Error('Existing project belongs to another ROM; choose a new output directory.');}}}
  // Persistent knowledge lives outside both the Forja ZIP and the generated port.
  // A fresh directory can recover ROM-bound observations from previous projects.
  let vault=null,vaultPrior=null,vaultError=null;
  if(useKnowledgeVault)try{
   vault=Vault.instance(rom,romBytes,{home:knowledgeHome});
   vaultPrior=vault.load({isCompatible:isAuditedCacheVersion});
  }catch(error){vaultError='load: '+error.message;vault=null;}
  const savedProfile=path.join(out,'profiles/game_config.json');profile=profile||(existing&&fs.existsSync(savedProfile)?JSON.parse(fs.readFileSync(savedProfile,'utf8')):vaultPrior?.profile||{});
 const savedKnowledge=path.join(out,'analysis/knowledge-pack.json');if(!knowledge&&existing&&fs.existsSync(savedKnowledge))knowledge=JSON.parse(fs.readFileSync(savedKnowledge,'utf8'));if(!knowledge&&vaultPrior?.knowledge)knowledge=vaultPrior.knowledge;if(knowledge){knowledge=C.normalizeKnowledgePack(knowledge,hash);profile=C.mergeKnowledgeProfile(profile,knowledge,hash);}
 const texts=[vaultPrior?.hints||'',hints];if(existing)for(const n of ['analysis/runtime-hints.txt','forja65-runtime-hints.txt','forja65-oracle-hints.txt'])texts.push(readOptional(path.join(out,n)));
 const byKey=new Map();for(const text of texts)for(const h of C.parseRuntimeHints(text)){const key=hintKey(h),prev=byKey.get(key);if(!prev||h.observed>prev.observed)byKey.set(key,h);}const bound=[...byKey.values()];if(bound.some(h=>h.rom&&h.rom!==hash))throw new Error('Runtime hints belong to another ROM.');for(const h of bound)h.rom=hash;
 const savedHints=C.formatRuntimeHints(bound);
 const cachePath=path.join(out,'analysis/cfg-coverage-cache.json');
 const localPrevious=existing&&fs.existsSync(cachePath)?JSON.parse(fs.readFileSync(cachePath,'utf8')):null;
  const previous=localPrevious||vaultPrior?.cache||null;
 const optionsPath=path.join(out,'analysis/generation-options.json');
 const savedOptions=existing&&fs.existsSync(optionsPath)?JSON.parse(fs.readFileSync(optionsPath,'utf8')):{};
 internalReplay=internalReplay===undefined?savedOptions.internalReplay!==false:internalReplay!==false;
 internalReplayBudget=internalReplayBudget===undefined?savedOptions.internalReplayBudget:internalReplayBudget;
 if(internalReplayBudget!==undefined&&(!Number.isInteger(internalReplayBudget)||internalReplayBudget<0||internalReplayBudget>8192))throw new Error('internalReplayBudget must be an integer between 0 and 8192');
 persistentAnalysis=persistentAnalysis===undefined?savedOptions.persistentAnalysis!==false:persistentAnalysis!==false;
 indirectRie=indirectRie===undefined?savedOptions.indirectRie!==false:indirectRie!==false;
 globalCfg=globalCfg===undefined?savedOptions.globalCfg!==false:globalCfg!==false;
 globalCfgRounds=globalCfgRounds===undefined?(savedOptions.globalCfgRounds??1):globalCfgRounds;
 globalCfgBudget=globalCfgBudget===undefined?savedOptions.globalCfgBudget:globalCfgBudget;
 if(!Number.isInteger(globalCfgRounds)||globalCfgRounds<0||globalCfgRounds>2)throw new Error('globalCfgRounds must be an integer between 0 and 2');
 if(globalCfgBudget!==undefined&&(!Number.isInteger(globalCfgBudget)||globalCfgBudget<0||globalCfgBudget>8192))throw new Error('globalCfgBudget must be an integer between 0 and 8192');
 const savedLimit=savedOptions.cacheLimit??32768;
 // Legacy generation-options files had no mode. A nondefault saved limit is
 // treated as manual for backward compatibility; an exact CLI override is manual.
 const automaticLimit=cacheLimit===null && (savedOptions.cacheLimitMode==='auto'||(savedOptions.cacheLimitMode!== 'manual'&&savedLimit===32768));
 if(cacheLimit===null)cacheLimit=savedLimit;
 if(!Number.isSafeInteger(cacheLimit)||cacheLimit<1||cacheLimit>1000000)throw new Error('cacheLimit must be an integer between 1 and 1000000');
 const ordered=prioritizeUncoveredHints(bound,previous);
 // Explicit migration seeds are candidates to decode from the cartridge, not
 // coverage to copy from an incompatible legacy cache. Default remains empty.
 const frontierImport=globalCfg?C.cfgFrontierSeeds(rom,previous,knowledge):{seeds:[],rejected:0,contextMatched:false};
 const legacySeeds=!previous?Vault.seedsFromLegacyCache(vaultPrior?.oldCache):[];
 const candidates=[...cachedCallerSeeds(ordered,previous,rom),...frontierImport.seeds,...legacySeeds,...discoverySeeds];
 const inventoryCache=require('./rie-cache').createInventoryCache(path.join(out,'analysis','rie-scan-cache'),{deferred:true});
 const memoryIdentity={rom:hash,romSha256:require('node:crypto').createHash('sha256').update(romBytes).digest('hex'),name:rom.name,source:Memory.sourceIdentity(path.join(__dirname,'..'))};
 const analysisMemory=Memory.createAnalysisMemory(path.join(out,'analysis','rie-analysis-cache'),{identity:memoryIdentity,enabled:persistentAnalysis});
 const internalContext=memoryIdentity.romSha256+':'+memoryIdentity.source+':'+C.semanticProofFingerprint({knowledge,indirectRie,globalCfg});
 const internalImport=InternalReplay.prepare(internalReplay?previous:null,{rom:hash,version:C.VERSION,context:internalContext});
 const replayFocus=new Map(internalImport.focus);for(const [key,values]of focusFrontiers||[])replayFocus.set(key,new Set([...(replayFocus.get(key)||[]),...values]));
 const requiredHints=!localPrevious&&vaultPrior?.cache?C.parseRuntimeHints(hints):ordered;
 const bounded=analyzeWithinCacheLimit(rom,max,ordered,{knowledge,discoverySeeds:candidates,focusFrontiers:internalReplay?replayFocus:focusFrontiers,internalCoverage:internalReplay?internalImport.coverage:undefined,internalReplayBudget,inventoryCache,globalCfg,globalCfgRounds,globalCfgBudget,indirectRie,globalCfgCeiling:cacheLimit},previous,hash,cacheLimit,analysisMemory,requiredHints,automaticLimit?131072:0);
 cacheLimit=bounded.cacheLimit;
 const {a}=bounded;
 a.internalReplayContext=internalReplay?internalContext:null;
 if(a.rieInternalReplay)a.rieInternalReplay.cacheImport={accepted:internalImport.accepted,rejected:internalImport.rejected,truncated:internalImport.truncated,priorities:internalImport.priorities,contextMatched:internalImport.contextMatched};
 if(a.rieGlobal){
  a.rieGlobal.cacheImport={accepted:frontierImport.seeds.length,rejected:frontierImport.rejected,contextMatched:frontierImport.contextMatched};
  if(previous){a.rieGlobal.initialDecoded=new Set(previous.functions.flatMap(f=>f.instructions.map(i=>i.pc)).filter(pc=>((pc>>>16)&255)!==0x7e&&((pc>>>16)&255)!==0x7f)).size;a.rieGlobal.baselineIncludesPersistentCache=true;}
  C.refreshCfgGlobal(rom,a);
 }
 // REV202: STATUS final com evidencia de execucao. Certificados REV200 desta ROM (cofre e analysis/route-certifications/)
 // promovem o port; sem certificado vale o STATUS estatico, agora sem contar avisos especulativos/resolvidos em runtime.
 {const certs=[];try{if(vault&&vault.certifications)certs.push(...vault.certifications());}catch(_){}
  const certDir=path.join(out,'analysis','route-certifications');
  if(fs.existsSync(certDir))for(const f of fs.readdirSync(certDir).filter(f=>f.endsWith('.json')))try{certs.push(JSON.parse(fs.readFileSync(path.join(certDir,f),'utf8')));}catch(_){}
  C.finalizePortStatus(a,certs,{sha256:require('node:crypto').createHash('sha256').update(Buffer.from(rom.data)).digest('hex')});}
 const files=C.generateProject(rom,a,{profile,trace,inventoryCache});
 // Commit optional cache writes only after analysis/ceiling/generation succeed.
 // A rejected initial build must not create an invalid output directory.
 if(files['analysis/cfg-global.json']){a.rieGlobal=JSON.parse(files['analysis/cfg-global.json']);a.cfgFrontier=a.rieGlobal.frontier;a.cfgFrontierContext=a.rieGlobal.context;}
 const persisted=inventoryCache.commit();
 const memoPersistence=analysisMemory.commit();
 // Retained CFG coverage can exceed the fresh decode budget. Return the same
 // final inventory exported by the generator, rather than its pre-merge snapshot.
 if(files['analysis/rom-inventory.json']){
  const inv=JSON.parse(files['analysis/rom-inventory.json']);inv.cache.persistence=persisted.failed?'write-error':'ready';
  if(persisted.failed)inv.notes.push('Persistent scan cache could not be written; generation continues with in-memory analysis.');
  files['analysis/rom-inventory.json']=JSON.stringify(inv,null,2);
  files['analysis/rom-inventory.md']=globalThis.Forja65RomInventory.markdown(inv);a.romInventory=inv;
 }
 let previousMemory=null;try{const p=path.join(out,'analysis/persistent-analysis.json');if(fs.statSync(p).size<=2*1024*1024)previousMemory=JSON.parse(fs.readFileSync(p,'utf8'));}catch(_){}
 files['analysis/internal-replay.json']=JSON.stringify(a.rieInternalReplay||{schema:'forja65.internal-replay.v1',enabled:false},null,2)+'\n';
 files['analysis/persistent-analysis.json']=JSON.stringify(Memory.knowledgeReport(a,previous,previousMemory,memoryIdentity,{...analysisMemory.stats,persistence:memoPersistence}),null,2)+'\n';
 files['analysis/cfg-coverage-cache.json']=JSON.stringify(makeCfgCache(a,hash))+'\n';
 if(knowledge)files['analysis/knowledge-pack.json']=JSON.stringify(knowledge,null,2)+'\n';
 files['analysis/runtime-hints.txt']=savedHints+'\n';
 files['analysis/generation-options.json']=JSON.stringify({schema:1,rom:hash,max,cacheLimit,cacheLimitMode:automaticLimit?'auto':'manual',globalCfg,globalCfgRounds,globalCfgBudget,indirectRie,persistentAnalysis,internalReplay,internalReplayBudget},null,2)+'\n';
 files['reports/cfg-discovery-budget.json']=JSON.stringify({schema:2,requested:max,accepted:bounded.budget,cacheLimit,cacheLimitMode:automaticLimit?'auto':'manual',cacheLimitAutoGrew:bounded.cacheLimitAutoGrew,attempts:bounded.attempts},null,2)+'\n';
 const preserved={};if(existing)for(const n of ['src/native_hooks.cpp','tests/equivalence-cases.txt']){const p=path.join(out,n);if(fs.existsSync(p))files[n]=fs.readFileSync(p,'utf8');}
 const changed=writeFiles(out,files);
  let vaultSaved=null;
  if(vault)try{vaultSaved=vault.save({hints:savedHints,knowledge,profile,cache:makeCfgCache(a,hash),origin:path.basename(out)});}catch(error){vaultError='save: '+error.message;}
  const vaultReport={schema:'forja65.knowledge-vault-report.v1',enabled:!!useKnowledgeVault,location:vault?.folder||null,romSha256:Vault.identity(rom,romBytes).sha256,restored:{hints:C.parseRuntimeHints(vaultPrior?.hints||'').length,compatibleCfg:!!(vaultPrior?.cache&&!localPrevious),historicalHintsStillPending:!localPrevious&&vaultPrior?.cache?prioritizeUncoveredHints(bound,a).filter(h=>!h.cachedCoverage).length:0,legacySeeds:legacySeeds.length,knowledgePack:!!vaultPrior?.knowledge},saved:vaultSaved?{revision:vaultSaved.revision,changed:vaultSaved.changed}:null,errors:[...(vaultPrior?.errors||[]),...(vaultError?[vaultError]:[])]};
  files['analysis/knowledge-vault.json']=JSON.stringify(vaultReport,null,2)+'\n';
  changed.push(...writeFiles(out,{'analysis/knowledge-vault.json':files['analysis/knowledge-vault.json']}));
  for(const n of ['analysis/internal-replay.json','analysis/persistent-analysis.json','analysis/rom-inventory.json','analysis/rom-inventory.md','analysis/cfg-coverage-cache.json','analysis/runtime-hints.txt','analysis/generation-options.json','analysis/knowledge-vault.json','reports/cfg-discovery-budget.json','src/native_hooks.cpp','tests/equivalence-cases.txt'])if(files[n]!==undefined)preserved[n]=files[n];refreshManifest(out,preserved);
  return {rom,a,hints:savedHints,changed,vault:vaultReport};
}
module.exports={writeFiles,refreshManifest,generate,readOptional,hintKey,makeCfgCache,mergeCfgCoverage,prioritizeUncoveredHints,cachedCallerSeeds,isAuditedCacheVersion,analyzeWithinCacheLimit};
