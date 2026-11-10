#!/usr/bin/env node
'use strict';
/*
 * Explicit, fail-closed migration for the divergent v0.4.29 SMW CFG format.
 * Does NOT import old instruction records, CFG edges or opaque CPU states.
 * A full new analysis, on the ORIGINAL ROM, must recreate every old
 * state/function/edge/call/return target before any project is overwritten.
 */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const C=require('../forja65-core.js');
const IO=require('./project-io.js');
const OLD_VERSION='0.4.29-monotonic-cfg-growth';
const SCHEMA='forja65.cfg-coverage-cache.v1';
const MAX_VARIANTS=1000000;
const MAX_RECOVERY_SEEDS=256;
// A bounded migration-only search. The ordinary analyser is unchanged.
const DEFAULT_INTERNAL_PASSES=24;
const MAX_INTERNAL_PASSES=64;
const MAX_INTERNAL_CANDIDATES=64;
function parseArgs(argv){
 const opts={apply:false};
 for(let i=0;i<argv.length;i++){
  const flag=argv[i];
  if(flag==='--apply'){opts.apply=true;continue;}
  if(flag==='--recover-legacy-seeds'){opts.recoverLegacySeeds=true;continue;}
  if(flag==='--recover-internal-frontiers'){opts.recoverInternalFrontiers=true;continue;}
  if(flag==='--internal-passes'||flag==='--budget-ceiling'){
   if(!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Missing value for '+flag);
   opts[flag==='--internal-passes'?'internalPassLimit':'budgetCeiling']=argv[++i];continue;
  }
  if(!['--project','--max','--cache-limit'].includes(flag)||!argv[i+1]||argv[i+1].startsWith('--'))
   throw Error('Usage: node tools/migrate-smw-cfg-cache.js --project DIR [--max N] [--cache-limit N] [--recover-legacy-seeds] [--recover-internal-frontiers] [--internal-passes 1..64] [--budget-ceiling N] [--apply]');
  opts[flag.slice(2)]=argv[++i];
 }
 if(!opts.project)throw Error('Missing --project DIR');
 opts.project=path.resolve(opts.project);
 return opts;
}
function getJSON(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function isNumber(v,min,max){return Number.isSafeInteger(v)&&v>=min&&v<=max;}
function sha(b){return crypto.createHash('sha256').update(b).digest('hex');}
function sameArrayOfEvidence(older,newer,selector){
 const a=new Set(older.map(selector)),b=new Set(newer.map(selector));
 return {old:a.size,new:b.size,missing:[...a].filter(key=>!b.has(key))};
}
function collect(cache){
 const functions=cache.functions||[];
 return {
  functions:functions.map(f=>f.functionKey),
  states:functions.flatMap(f=>f.instructions.map(i=>i.stateKey)),
  // Equal state keys alone do not prove equal instruction semantics. A ROM
  // decoder change might preserve the address/CPU width while changing the
  // byte length, operand, carry outcome or decoded control-flow target.
  instructionSemantics:functions.flatMap(f=>f.instructions.map(i=>JSON.stringify({
   stateKey:i.stateKey,pc:i.pc,opcode:i.opcode,mnemonic:i.mnemonic,
   mode:i.mode,operand:i.operand,size:i.size,raw:i.raw,
   status:i.status,flowTarget:i.flowTarget,stateIn:i.stateIn,stateOut:i.stateOut
  }))),
  edges:functions.flatMap(f=>(f.edges||[]).map(e=>[f.functionKey,JSON.stringify(e)].join('|'))),
  calls:functions.flatMap(f=>(f.calls||[]).map(c=>[f.functionKey,JSON.stringify(c)].join('|'))),
  blocks:functions.flatMap(f=>(f.blocks||[]).map(b=>[f.functionKey,JSON.stringify(b)].join('|'))),
  staticReturnTargets:cache.staticReturnTargets||[],
  syntheticReturnTargets:cache.syntheticReturnTargets||[]
 };
}
function compareCoverage(oldCache,newCache){
 const a=collect(oldCache),b=collect(newCache),counts={},missing={};
 for(const k of Object.keys(a)){
  const r=sameArrayOfEvidence(a[k],b[k],x=>String(x));
  counts[k]={old:r.old,new:r.new,missing:r.missing.length};
  if(r.missing.length)missing[k]=r.missing.slice(0,12);
 }
 return {complete:Object.values(counts).every(x=>!x.missing),counts,examples:missing};
}
// Recovery is opt-in. A historical entry is only a candidate: verify ROM
// ownership and decode its first opcode again with the ACTIVE decoder before
// seeding a fresh analysis. No old instructions, graph edges or handlers are
// imported. Requiring a complete coverage comparison below is still mandatory.
function discoverRomBackedLegacySeeds(rom,oldCache,newCache){
 const present=new Set((newCache.functions||[]).map(f=>f.functionKey));
 const missing=(oldCache.functions||[]).filter(f=>!present.has(f.functionKey));
 const result={missingFunctions:missing.length,accepted:0,rejected:0,truncated:0,
  candidates:[],rejections:[],seeds:[]};
 for(const f of missing){
  if(result.accepted>=MAX_RECOVERY_SEEDS){result.truncated++;continue;}
  let reason=null,decoded=null;
  const st=f.entryState,first=Array.isArray(f.instructions)?f.instructions.find(i=>i.pc===f.start):null;
  if(!isNumber(f.start,0,0xffffff)||!C.isRomAddress(rom,f.start))reason='not a ROM address';
  else if(!st||typeof st.emulation!=='boolean'||typeof st.m8!=='boolean'||typeof st.x8!=='boolean'||
    !(st.carry===null||typeof st.carry==='boolean')||(st.emulation&&(!st.m8||!st.x8)))reason='invalid CPU entry state';
  else if(!first||!first.stateIn||!['native','partial'].includes(first.status)||!Array.isArray(first.raw))reason='missing legacy first opcode';
  else if(['emulation','m8','x8','carry'].some(k=>first.stateIn[k]!==st[k]))reason='entry state differs from first instruction';
  else{
   try{decoded=C.decodeOne(rom,f.start,st);}catch(e){reason='active decoder refused entry';}
   if(!reason&&(!decoded||decoded.status!==first.status||decoded.opcode!==first.opcode||
     decoded.mnemonic!==first.mnemonic||decoded.mode!==first.mode||decoded.operand!==first.operand||
     decoded.size!==first.size||JSON.stringify(decoded.raw)!==JSON.stringify(first.raw)))
     reason='legacy opcode differs from active ROM decoder';
  }
  if(reason){result.rejected++;if(result.rejections.length<16)result.rejections.push({functionKey:f.functionKey,reason});continue;}
  result.accepted++;
  if(result.candidates.length<16)result.candidates.push({functionKey:f.functionKey,pc:f.start,opcode:decoded.mnemonic});
  result.seeds.push({start:f.start,state:{...st},entryName:'CACHED-CALL'});
 }
 return result;
}
// An internal frontier is useful only when the active decoder found its
// parent function already. Historical state keys select scheduling preference
// at an already-reachable queued node; they do not inject that node/state.
// The original ROM and CURRENT decoder must agree with the candidate's bytes.
function selectInternalFrontiers(rom,oldCache,newCache,limit=MAX_INTERNAL_CANDIDATES,skip=new Set()){
 const current=new Map((newCache.functions||[]).map(f=>[f.functionKey,f]));
 const candidates=[],rejections=[];
 let missing=0,skipped=0;
 for(const old of oldCache.functions||[]){
  const fresh=current.get(old.functionKey);
  if(!fresh)continue;
  const known=new Set((fresh.instructions||[]).map(i=>i.stateKey));
  for(const i of old.instructions||[]){
   if(known.has(i.stateKey))continue;
   missing++;
   // Scan past exhausted targets: a fixed first-page cap must not starve
   // later branches in ROMs with hundreds of internal frontiers.
   if(skip.has(old.functionKey+'|'+i.stateKey)){skipped++;continue;}
   if(candidates.length>=limit)continue;
   let reason=null;
   if(!isNumber(i.pc,0,0xffffff)||!C.isRomAddress(rom,i.pc))reason='not a ROM address';
   else if(!i.stateIn||typeof i.stateIn.emulation!=='boolean'||typeof i.stateIn.m8!=='boolean'||typeof i.stateIn.x8!=='boolean'||
    !(i.stateIn.carry===null||typeof i.stateIn.carry==='boolean'))reason='invalid historical instruction state';
   else if(typeof i.stateKey!=='string'||!i.stateKey.startsWith(i.pc.toString(16).toUpperCase().padStart(6,'0')+'|'))reason='invalid state key address';
   else {
    let decoded,st={...i.stateIn};
    try{decoded=C.decodeOne(rom,i.pc,st);}catch{reason='active ROM decoder refused instruction';}
    if(!reason&&(!decoded||decoded.status!==i.status||decoded.opcode!==i.opcode||
      decoded.mnemonic!==i.mnemonic||decoded.mode!==i.mode||decoded.operand!==i.operand||
      decoded.size!==i.size||JSON.stringify(decoded.raw)!==JSON.stringify(i.raw)))
      reason='legacy instruction differs from active decoder';
   }
   if(reason){if(rejections.length<16)rejections.push({functionKey:old.functionKey,stateKey:i.stateKey,reason});continue;}
   candidates.push({functionKey:old.functionKey,stateKey:i.stateKey,pc:i.pc});
  }
 }
 return {missing,candidates,rejections,limit,skipped};
}
function readManifest(project){
 const file=path.join(project,'forja65-build-manifest.txt');
 if(!fs.existsSync(file))return null;
 const result=new Map();
 for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
  const m=/^file=(.+) size=(\d+) fnv1a64=([0-9a-f]+)$/i.exec(line);
  if(m)result.set(m[1],{size:Number(m[2]),hash:m[3].toLowerCase()});
 }
 return result;
}
function guardEditedSources(project,files,preservedReports=[]){
 const preserving=new Set(preservedReports);
 const manifest=readManifest(project);const issues=[];
 if(!manifest)return ['Missing forja65-build-manifest.txt; cannot prove generated sources are pristine'];
 for(const file of files){
  if(['analysis/cfg-coverage-cache.json','forja65-build-manifest.txt'].includes(file))continue;
  const original=path.join(project,file);
  if(!fs.existsSync(original))continue;
  if(fs.lstatSync(original).isSymbolicLink()) {issues.push(file+' is a symbolic link');continue;}
  const data=fs.readFileSync(original),expected=manifest.get(file);
  if(!expected){if(preserving.has(file))continue;issues.push(file+' not tracked in build manifest');continue;}
  if(expected.size!==data.length||expected.hash!==C.fnv1a64Bytes(data))issues.push(file+' changed since build manifest');
 }
 return issues;
}
// Earlier generator revisions wrote the budget diagnostic without recording
// it in the build manifest. Preserve its original bytes under a collision-
// checked, content-addressed filename rather than silently overwriting it or
// treating this known *report* (never executable C++) as a source edit.
function preserveLegacyDiagnostics(project,stage,changes){
 const manifest=readManifest(project),backups=[],preserved=[];
 if(!manifest)return {backups,preserved};
 for(const n of ['reports/cfg-discovery-budget.json']){
  const src=path.join(project,n);
  if(!changes.includes(n)||!fs.existsSync(src)||manifest.has(n))continue;
  if(fs.lstatSync(src).isSymbolicLink())throw Error('Legacy diagnostic is a symbolic link: '+n);
  const original=fs.readFileSync(src);
  const backup='reports/cfg-discovery-budget.pre-smw-'+sha(original).slice(0,16)+'.json';
  const dest=path.join(project,backup);
  if(fs.existsSync(dest)){
   if(fs.lstatSync(dest).isSymbolicLink()||!fs.readFileSync(dest).equals(original))
    throw Error('Cannot preserve legacy diagnostic; backup collision: '+backup);
  }else{
   const stagedBackup=path.join(stage,backup);
   fs.mkdirSync(path.dirname(stagedBackup),{recursive:true});
   fs.writeFileSync(stagedBackup,original);
   backups.push(backup);
  }
  preserved.push(n);
 }
 return {backups,preserved};
}
function validate(project,maxOverride=null,limitOverride=null){
 const base=path.join(project,'analysis'),oldPath=path.join(base,'cfg-coverage-cache.json'),optPath=path.join(base,'generation-options.json');
 const cartPath=path.join(project,'assets/cart-data.bin');
 for(const p of [cartPath,oldPath,optPath])if(!fs.existsSync(p)||fs.lstatSync(p).isSymbolicLink())throw Error('Missing or linked required input: '+path.relative(project,p));
 const original=fs.readFileSync(oldPath),old=getJSON(oldPath),options=getJSON(optPath);
 const rom=C.loadRom(new Uint8Array(fs.readFileSync(cartPath)),'cart-data.bin'),romHash=C.romFingerprint(rom);
 if(old.schema!==SCHEMA||old.version!==OLD_VERSION||!Array.isArray(old.functions))
  throw Error('Unsupported cache schema/version; only '+OLD_VERSION+' may use this supervised migration');
 if(!/^[0-9a-f]{16}$/.test(romHash)||old.rom!==romHash||options.rom!==romHash)
  throw Error('ROM fingerprint mismatch between actual cartridge, old cache and generation options');
 const analysisPath=path.join(project,'analysis.json');
 if(fs.existsSync(analysisPath)){
  const meta=getJSON(analysisPath),identity=meta.rom_fingerprint||meta.rom;
  if(identity&&identity!==romHash)throw Error('Project analysis.json belongs to a different ROM');
 }
 for(const f of old.functions){
  if(typeof f.functionKey!=='string'||!f.functionKey||!Array.isArray(f.instructions)||!f.entryState)
   throw Error('Malformed legacy CFG function');
  for(const i of f.instructions)if(typeof i.stateKey!=='string'||!i.stateKey||!isNumber(i.pc,0,0xffffff))
   throw Error('Malformed legacy instruction record');
 }
 const max=maxOverride===null?options.max:Number(maxOverride);
 const cacheLimit=limitOverride===null?(options.cacheLimit??32768):Number(limitOverride);
 if(!isNumber(max,1,MAX_VARIANTS)||!isNumber(cacheLimit,1,MAX_VARIANTS))throw Error('Invalid max or cache-limit (1..1000000)');
 return {old,original,rom:romHash,loadedRom:rom,max,cacheLimit,romPath:cartPath,oldPath};
}
function listNewOrChanged(project,stage,changes){
 const out=[...new Set([...changes,'forja65-build-manifest.txt'])].sort();
 return out.filter(n=>{
  const source=path.join(stage,n),dest=path.join(project,n);
  if(!fs.existsSync(source))throw Error('Missing staged result: '+n);
  return !fs.existsSync(dest)||!fs.readFileSync(dest).equals(fs.readFileSync(source));
 });
}
function commit(project,stage,paths){
 // Validate the entire write-set before touching any destination.
 const pending=paths.map(n=>{
  if(path.isAbsolute(n)||n.split(/[\\/]/).includes('..'))throw Error('Unsafe staged destination');
  const dest=path.join(project,n),src=path.join(stage,n);
  if(fs.existsSync(dest)&&fs.lstatSync(dest).isSymbolicLink())throw Error('Symlink destination: '+n);
  return {n,dest,data:fs.readFileSync(src),prior:fs.existsSync(dest)?fs.readFileSync(dest):null};
 });
 const finished=[];
 try{
  for(const f of pending){
   fs.mkdirSync(path.dirname(f.dest),{recursive:true});finished.push(f);fs.writeFileSync(f.dest,f.data);
  }
 }catch(e){
  for(const f of finished.reverse()){
   if(f.prior===null)fs.rmSync(f.dest,{force:true});else fs.writeFileSync(f.dest,f.prior);
  }
  throw e;
 }
}
function run(o){
 const passes=o.internalPassLimit===undefined?DEFAULT_INTERNAL_PASSES:Number(o.internalPassLimit);
 if(!isNumber(passes,1,MAX_INTERNAL_PASSES))throw Error('Invalid internal-passes (1..64)');
 if(o.internalPassLimit!==undefined&&!o.recoverInternalFrontiers)
  throw Error('--internal-passes requires --recover-internal-frontiers');
 if(o.budgetCeiling!==undefined&&!o.recoverInternalFrontiers)
  throw Error('--budget-ceiling requires --recover-internal-frontiers');
 const check=validate(o.project,o.max===undefined?null:o.max,o['cache-limit']===undefined?null:o['cache-limit']);
 const budgetCeiling=o.budgetCeiling===undefined?null:Number(o.budgetCeiling);
 if(budgetCeiling!==null&&(!isNumber(budgetCeiling,check.max,MAX_VARIANTS)||budgetCeiling===check.max))
  throw Error('Invalid budget-ceiling; it must be > --max and <= 1000000');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-smw-cfg-migration-'));
 try{
  const stage=path.join(tmp,'project');
  fs.cpSync(o.project,stage,{recursive:true,filter(p){
   const rel=path.relative(o.project,p),parts=rel.split(path.sep);
   if(parts.some(n=>n==='.git'||/^build(?:$|-)/.test(n)||n==='node_modules'))return false;
   // A staged symlink could point back to the ORIGINAL project and violate dry-run.
   if(fs.lstatSync(p).isSymbolicLink())throw Error('Symlink inside project; refusing unsafe staging: '+rel);
   return true;
  }});
  // Critical: never pass the divergent old cache into mergeCfgCoverage.
  fs.rmSync(path.join(stage,'analysis/cfg-coverage-cache.json'));
  const built=IO.generate({romPath:check.romPath,out:stage,internalReplay:false,useKnowledgeVault:false,max:check.max,cacheLimit:check.cacheLimit,update:true});
  let rebuilt=getJSON(path.join(stage,'analysis/cfg-coverage-cache.json'));
  if(rebuilt.version!==C.VERSION||rebuilt.rom!==check.rom)throw Error('Fresh CFG regeneration produced invalid version/ROM');
  let coverage=compareCoverage(check.old,rebuilt);
  let recovery={enabled:!!o.recoverLegacySeeds,attempted:false,missingFunctions:0,accepted:0,
   rejected:0,truncated:0,candidates:[],rejections:[],coverageBefore:coverage.counts};
  if(!coverage.complete&&o.recoverLegacySeeds){
   const candidates=discoverRomBackedLegacySeeds(check.loadedRom,check.old,rebuilt);
   recovery={...candidates,enabled:true,attempted:true,coverageBefore:coverage.counts};
   delete recovery.seeds;
   if(candidates.seeds.length){
    // This regeneration reads only the stage's newly produced *current* cache.
    // The divergent legacy cache was removed before the first pass.
    const second=IO.generate({romPath:check.romPath,out:stage,internalReplay:false,useKnowledgeVault:false,max:check.max,
     cacheLimit:check.cacheLimit,discoverySeeds:candidates.seeds,update:true});
    built.changed=[...new Set([...built.changed,...second.changed])];
    rebuilt=getJSON(path.join(stage,'analysis/cfg-coverage-cache.json'));
    coverage=compareCoverage(check.old,rebuilt);
   }
  }
  // Additional passes deliberately steer only worklist order inside a
  // function already discovered by the new analyser. Every pass redecodes
  // from RESET, merges only CURRENT-version records, and must pass the same
  // final full-evidence comparison as the ordinary migration.
  const internal={enabled:!!o.recoverInternalFrontiers,attempted:false,passes:[],passLimit:passes,
   requestedMax:check.max,missingBefore:0,missingAfter:0,rejections:[],coverageBefore:coverage.counts,
   stopReason:'disabled'};
  if(!coverage.complete&&o.recoverInternalFrontiers){
   internal.attempted=true;
   const tried=new Set();
   const missingEvidence=c=>Object.values(c.counts).reduce((n,x)=>n+x.missing,0);
   let epochStart=missingEvidence(coverage);
   internal.stopReason='pass limit reached';
   for(let pass=0;pass<passes;pass++){
    let selection=selectInternalFrontiers(check.loadedRom,check.old,rebuilt,MAX_INTERNAL_CANDIDATES,tried);
    if(pass===0)internal.missingBefore=selection.missing;
    internal.missingAfter=selection.missing;
    internal.rejections.push(...selection.rejections.slice(0,Math.max(0,16-internal.rejections.length)));
    if(!selection.candidates.length){
     // One more fair sweep is useful only after another candidate contributed
     // genuinely new evidence. Never spin on an unchanged generated file.
     if(tried.size&&selection.skipped&&missingEvidence(coverage)<epochStart){
      tried.clear();epochStart=missingEvidence(coverage);
      selection=selectInternalFrontiers(check.loadedRom,check.old,rebuilt,MAX_INTERNAL_CANDIDATES,tried);
     }
     if(!selection.candidates.length){
      internal.stopReason=selection.missing===0?'no missing internal states':'no further ROM-verified frontiers';
      break;
     }
    }
    const chosen=selection.candidates[0];
    tried.add(chosen.functionKey+'|'+chosen.stateKey);
    const focus=new Map([[chosen.functionKey,new Set([chosen.stateKey])]]);
    const beforeMissing=missingEvidence(coverage);
    const second=IO.generate({romPath:check.romPath,out:stage,internalReplay:false,useKnowledgeVault:false,max:check.max,
     cacheLimit:check.cacheLimit,focusFrontiers:focus,update:true});
    built.changed=[...new Set([...built.changed,...second.changed])];
    rebuilt=getJSON(path.join(stage,'analysis/cfg-coverage-cache.json'));
    coverage=compareCoverage(check.old,rebuilt);
    const afterStates=selectInternalFrontiers(check.loadedRom,check.old,rebuilt).missing;
    const afterMissing=missingEvidence(coverage);
    // The accepted budget may be below max due to the existing cache ceiling.
    // Report the actual accepted budget instead of implying that --max won.
    const budgetReport=getJSON(path.join(stage,'reports/cfg-discovery-budget.json'));
    internal.passes.push({functionKey:chosen.functionKey,stateKey:chosen.stateKey,
     beforeStates:selection.missing,afterStates,evidenceBefore:beforeMissing,evidenceAfter:afterMissing,
     evidenceGained:beforeMissing-afterMissing,acceptedBudget:budgetReport.accepted,
     coverageComplete:coverage.complete});
    internal.missingAfter=afterStates;
    if(coverage.complete){internal.stopReason='coverage complete';break;}
   }
  }else if(o.recoverInternalFrontiers)internal.stopReason=coverage.complete?'initial analysis complete':'disabled';
  // Expanding the analysis budget is a SECOND, independent, opt-in safeguard.
  // It never changes the user's cache variant ceiling. Fresh code is decoded
  // from the ROM and unioned with the new-version cache before comparison.
  const escalation={enabled:budgetCeiling!==null,attempted:false,ceiling:budgetCeiling,
   steps:[],effectiveMax:check.max,stopReason:budgetCeiling===null?'not requested':'not needed'};
  if(!coverage.complete&&budgetCeiling!==null){
   escalation.attempted=true;
   let budget=check.max;
   while(!coverage.complete&&budget<budgetCeiling){
    budget=Math.min(budgetCeiling,Math.max(budget+1,budget*2));
    const before=Object.values(coverage.counts).reduce((n,x)=>n+x.missing,0);
    const higher=IO.generate({romPath:check.romPath,out:stage,internalReplay:false,useKnowledgeVault:false,max:budget,cacheLimit:check.cacheLimit,update:true});
    built.changed=[...new Set([...built.changed,...higher.changed])];
    rebuilt=getJSON(path.join(stage,'analysis/cfg-coverage-cache.json'));
    coverage=compareCoverage(check.old,rebuilt);
    const report=getJSON(path.join(stage,'reports/cfg-discovery-budget.json'));
    escalation.steps.push({requested:budget,accepted:report.accepted,
     missingBefore:before,missingAfter:Object.values(coverage.counts).reduce((n,x)=>n+x.missing,0),
     complete:coverage.complete});
    escalation.effectiveMax=budget;
   }
   escalation.stopReason=coverage.complete?'coverage complete':'explicit ceiling reached with missing evidence';
  }
  // This supervised migrator owns its historical strict total-work budgets.
  // Disable scheduling credits only during its staged passes, then preserve
  // the user's normal creator preference for subsequent ordinary updates.
  const optionName='analysis/generation-options.json',originalOptions=getJSON(path.join(o.project,optionName)),stagedOptions=getJSON(path.join(stage,optionName));
  if(Object.prototype.hasOwnProperty.call(originalOptions,'internalReplay'))stagedOptions.internalReplay=originalOptions.internalReplay;
  else delete stagedOptions.internalReplay;
  const optionsText=JSON.stringify(stagedOptions,null,2)+'\n';
  IO.writeFiles(stage,{[optionName]:optionsText});IO.refreshManifest(stage,{[optionName]:optionsText});built.changed.push(optionName);
  const changes=listNewOrChanged(o.project,stage,built.changed);
  const savedDiagnostics=preserveLegacyDiagnostics(o.project,stage,changes);
  changes.push(...savedDiagnostics.backups);
  const edited=guardEditedSources(o.project,changes,savedDiagnostics.preserved);
  const summary={schema:'forja65.supervised-smw-cfg-migration.v1',status:'BLOCKED',mode:o.apply?'apply':'check',
   rom:check.rom,fromVersion:OLD_VERSION,toVersion:C.VERSION,max:check.max,cacheLimit:check.cacheLimit,
   oldCacheSha256:sha(check.original),newCacheSha256:sha(fs.readFileSync(path.join(stage,'analysis/cfg-coverage-cache.json'))),
   coverage,recovery,internal,escalation,effectiveMax:escalation.effectiveMax,preserved_untracked_reports:savedDiagnostics.preserved,changed_files:changes,edited_sources:edited,
   notes:['Reanalyzed the cartridge with the active Forja core; old instructions/edges were not imported.',
    'Legacy ROM-matched entries are decode candidates only, not proof of runtime execution.',
    'A complete CFG-state match does not prove emulation/gameplay equivalence. Compile and replay the generated port.']};
  if(!coverage.complete){summary.reason='Fresh ROM analysis cannot reproduce all historic CFG evidence';return summary;}
  if(edited.length){summary.reason='Generated files contain untracked or user changes; refusing to overwrite';return summary;}
  if(!o.apply){summary.status='READY';return summary;}
  // Reject concurrent changes since the snapshot was collected.
  if(sha(fs.readFileSync(check.oldPath))!==summary.oldCacheSha256)throw Error('CFG cache changed while migration was being prepared');
  summary.status='APPLIED';summary.migrated_files=changes.length+1;
  const reportName='reports/cfg-cache-smw-migration.json';
  const stagedReport=path.join(stage,reportName);
  fs.mkdirSync(path.dirname(stagedReport),{recursive:true});
  fs.writeFileSync(stagedReport,JSON.stringify(summary,null,2)+'\n');
  commit(o.project,stage,[...changes,reportName]);
  return summary;
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
if(require.main===module){try{const result=run(parseArgs(process.argv.slice(2)));console.log(JSON.stringify(result,null,2));if(result.status==='BLOCKED')process.exitCode=3;}
 catch(e){console.error('SMW CFG migration: '+e.message);process.exitCode=2;}}
module.exports={parseArgs,validate,compareCoverage,discoverRomBackedLegacySeeds,selectInternalFrontiers,guardEditedSources,run};
