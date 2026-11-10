#!/usr/bin/env node
'use strict';
// Independent read-only pre-analysis; the remaining CLI still uses the full Forja core.
if(process.argv[2]==='hardware-audit'){
 try{require('./snes-hardware-audit').main(process.argv.slice(3));}
 catch(e){console.error('Forja65 hardware-audit: '+e.message);process.exitCode=2;}
}else{
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os');
const C=require('../forja65-core.js');
const args=process.argv.slice(2),command=args.shift(),input=args.shift();
function option(name,def=null){const i=args.indexOf('--'+name);if(i<0)return def;if(i+1>=args.length||args[i+1].startsWith('--'))throw new Error('Missing --'+name+' value');return args[i+1];}
function jsonFile(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
const {writeFiles,refreshManifest,generate}=require('./project-io');
function run(exe,params,extra={}){const r=cp.spawnSync(exe,params,{stdio:'inherit',...extra});if(r.error)throw r.error;if(r.status!==0)throw new Error(exe+' failed with status '+r.status);}
function configure(project,trace=false){const params=['-S',project,'-B',path.join(project,'build'),'-DCMAKE_BUILD_TYPE=Release'];params.push('-DFORJA65_ENABLE_TRACE='+(trace?'ON':'OFF'));run('cmake',params);run('cmake',['--build',path.join(project,'build'),'--config','Release','-j','2']);}
function loadRom(file){return C.loadRom(new Uint8Array(fs.readFileSync(file)),path.basename(file));}
function issueCounts(a){const out={};for(const i of a.issues||[])out[i.kind]=(out[i.kind]||0)+(i.occurrences||1);return Object.fromEntries(Object.entries(out).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])));}
try {
 if(command==='analyze'){
  if(!input)throw new Error('ROM path required');
  const out=path.resolve(option('out','forja-project'));
  const knowledge=option('knowledge')?jsonFile(option('knowledge')):null;
  const result=generate({romPath:input,out,knowledgeHome:option('knowledge-home')||undefined,useKnowledgeVault:!args.includes('--no-knowledge-vault'),cacheLimit:option('cache-limit')?Number(option('cache-limit')):null,max:Number(option('max',fs.existsSync(path.join(out,'analysis/generation-options.json'))?String(jsonFile(path.join(out,'analysis/generation-options.json')).max):'262144')),hints:option('hints')?fs.readFileSync(option('hints'),'utf8'):'',profile:option('profile')?jsonFile(option('profile')):undefined,trace:option('trace')?C.parseTrace(fs.readFileSync(option('trace'),'utf8')):null,knowledge,update:args.includes('--update')});
  console.log('Project: '+out+'\nDecoded addresses: '+result.a.decoded+'; knowledge seeds: '+(result.a.knowledgeSeedsImported||0)+'; changed files: '+result.changed.length+'; host conversion coverage: unmeasured.');
  // Persist a *separate*, unverified static hardware investigation alongside
  // the generated native project. Do not inject its candidates into verified
  // dispatcher hints: the RIE/port must still prove them with runtime evidence.
  if(!args.includes('--no-hardware-audit')){
   try{
    const budget=Number(option('hardware-max','32768'));
    if(!Number.isInteger(budget)||budget<1||budget>2000000)throw Error('--hardware-max must be 1..2000000');
    const cacheDir=option('hardware-cache-dir',path.join(process.env.FORJA65_KNOWLEDGE_HOME||path.join(os.homedir(),'.forja65','knowledge-v1'),'hardware-audit'));
    const H=require('./snes-hardware-audit');
    const cfgSeeds=(result.a.functions||[]).slice(0,4096).filter(fn=>fn && Number.isSafeInteger(fn.start) && fn.entryState &&
      typeof fn.entryState.emulation==='boolean' &&
      (fn.entryState.m8==null || typeof fn.entryState.m8==='boolean') &&
      (fn.entryState.x8==null || typeof fn.entryState.x8==='boolean') &&
      (fn.entryState.carry==null || [0,1].includes(fn.entryState.carry)) &&
      (!fn.entryState.emulation || (fn.entryState.m8!==false && fn.entryState.x8!==false))).map(fn=>({
      pc:fn.start,e:fn.entryState.emulation?1:0,m:fn.entryState.m8==null?null:Number(!!fn.entryState.m8),
      x:fn.entryState.x8==null?null:Number(!!fn.entryState.x8),c:fn.entryState.carry==null?null:Number(!!fn.entryState.carry)
    }));
    const hardware=H.auditWithCache(fs.readFileSync(input),{max:budget,allVectors:args.includes('--hardware-all-vectors'),cacheDir,
      seeds:args.includes('--hardware-reset-only')?[]:cfgSeeds});
    const payload=JSON.stringify(hardware.result,null,2)+'\n';
    const entries={'analysis/snes-hardware-audit.json':payload};
    writeFiles(out,entries);
    refreshManifest(out,entries);
    console.log('SNES hardware audit: '+(hardware.hit?'cache reused':'fresh scan')+'; '+(hardware.result.scan?.decodedStates||0)+' static states from '+(hardware.result.cfgSeedInputs||0)+' CFG candidates; '+(hardware.result.scan?.resolvedRomLiteralIndirectTransfers||0)+' ROM-literal jumps; native equivalence not established.');
   }catch(e){console.warn('SNES hardware audit not completed (port generation remains intact): '+e.message);}
  }

 }else if(command==='certify-import'){
  // REV202: guarda no cofre um certification.json (REV200) desta ROM; a proxima geracao/analise usa o certificado no STATUS.
  if(!input||!option('rom'))throw new Error('Usage: certify-import certification.json --rom game.sfc [--label nome] [--knowledge-home folder]');
  const cert=JSON.parse(fs.readFileSync(input,'utf8'));const raw=fs.readFileSync(option('rom')),rom=C.loadRom(new Uint8Array(raw),path.basename(option('rom')));
  const v=require('./knowledge-vault').instance(rom,raw,{home:option('knowledge-home')||undefined});
  const r=v.addCertification(cert,{label:option('label')||null});
  console.log('Certificado de rota importado: '+cert.certified_logical_inputs+' entradas logicas, CPU AOT estrito; cofre '+r.folder+' (revisao '+r.revision+'). Gere/atualize o port para ver STATUS: PORT_JOGAVEL_ROTA_CERTIFICADA.');
 }else if(command==='vault-import'){
  if(!input)throw new Error('Usage: vault-import existing-project [--knowledge-home folder]');
  const project=path.resolve(input),romFile=path.join(project,'assets','cart-data.bin');
  if(!fs.existsSync(romFile))throw new Error('Missing assets/cart-data.bin in port: '+project);
  const raw=fs.readFileSync(romFile),rom=C.loadRom(new Uint8Array(raw),path.basename(romFile)),hash=C.romFingerprint(rom);
  const read=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8'):'';
  const json=f=>fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null;
  const vault=require('./knowledge-vault').instance(rom,raw,{home:option('knowledge-home')||undefined});
  const opts={hints:[read(path.join(project,'analysis/runtime-hints.txt')),read(path.join(project,'forja65-runtime-hints.txt')),read(path.join(project,'forja65-oracle-hints.txt'))].join('\n'),knowledge:json(path.join(project,'analysis/knowledge-pack.json')),profile:json(path.join(project,'profiles/game_config.json')),cache:json(path.join(project,'analysis/cfg-coverage-cache.json')),origin:path.basename(project)};
  const result=vault.save(opts);console.log('Vault: '+result.folder+'; ROM '+hash+'; revision '+result.revision+'; saved '+(result.changed.join(', ')||'already known'));
 }else if(command==='runtime-run'){
  if(!input)throw Error('Usage: runtime-run generated-project [--exec game.exe] [--frames 120] [--min-frames 120] [--checkpoint scene] [--timeout-ms 120000] [-- args]');
  const R=require('./runtime-evidence-vault').open(input,{home:option('knowledge-home')||undefined});
  const delim=args.indexOf('--'),childArgs=delim<0?[]:args.slice(delim+1);
  const e=R.run({exec:option('exec'),frames:Number(option('frames','120')),minFrames:Number(option('min-frames','0')),timeoutMs:Number(option('timeout-ms','120000')),checkpoint:option('checkpoint','default'),argv:childArgs});
  const gate=require('./regression-intelligence').open(input,{home:option('knowledge-home')||undefined}).check({checkpoint:e.checkpoint});
  console.log(JSON.stringify({id:e.id,status:e.status,checkpoint:e.checkpoint,frames:e.frames,exitCode:e.exitCode,artifacts:e.artifacts.map(x=>x.path),repairCheckpointMatches:e.repairCheckpointMatches,regressionGate:gate.details[0]},null,2));
  if(e.status==='failed'||e.status==='checkpoint-not-reached')process.exitCode=1;
  // Recommendations are evidence-only; do not patch generated code automatically.
  if(e.status==='failed'||e.status==='checkpoint-not-reached'){
   try{const advice=require('./recovery-advisor').open(input,{home:option('knowledge-home')||undefined}).save({limit:3});
    console.log(JSON.stringify({recoveryAdvisor:advice.report.issues.slice(0,3)},null,2));
   }catch(err){console.error('Recovery advisor unavailable: '+err.message);}
  }
  if(gate.regressions)process.exitCode=2;
 }else if(command==='legacy-import'){
  if(!input||!option('rom'))throw Error('Usage: legacy-import folder-or-zip --rom game.sfc [--apply] [--assume-same-rom] [--deep] [--knowledge-home folder]');
  const L=require('./legacy-port-archaeology').open(option('rom'),{home:option('knowledge-home')||undefined});
  const result=L.importFrom(input,{apply:args.includes('--apply'),deep:args.includes('--deep'),assumeSameRom:args.includes('--assume-same-rom')});
  console.log(JSON.stringify(result,null,2));
 }else if(command==='legacy-report'){
  if(!input)throw Error('Usage: legacy-report game.sfc [--knowledge-home folder]');
  console.log(JSON.stringify(require('./legacy-port-archaeology').open(input,{home:option('knowledge-home')||undefined}).report({limit:Number(option('limit','20'))}),null,2));
 }else if(command==='recovery-advice'){
  if(!input)throw Error('Usage: recovery-advice generated-project [--limit 10] [--include-closed] [--knowledge-home folder]');
  const A=require('./recovery-advisor').open(input,{home:option('knowledge-home')||undefined});
  const result=A.save({limit:Number(option('limit','10')),includeClosed:args.includes('--include-closed')});
  console.log(JSON.stringify({...result.report,adviceSaved:result.saved,adviceFile:result.path},null,2));
 }else if(command==='regression-freeze'){
  if(!input||!option('checkpoint'))throw Error('Usage: regression-freeze generated-project --checkpoint scene [--replace] [--allow-lower] [--knowledge-home folder]');
  const G=require('./regression-intelligence').open(input,{home:option('knowledge-home')||undefined});
  console.log(JSON.stringify(G.freeze({checkpoint:option('checkpoint'),replace:args.includes('--replace'),allowLower:args.includes('--allow-lower')}),null,2));
 }else if(command==='regression-check'){
  if(!input)throw Error('Usage: regression-check generated-project [--checkpoint scene] [--knowledge-home folder]');
  const G=require('./regression-intelligence').open(input,{home:option('knowledge-home')||undefined});
  const out=G.check({checkpoint:option('checkpoint')});console.log(JSON.stringify(out,null,2));
  if(out.regressions)process.exitCode=2;
  else if(out.inconclusive)process.exitCode=3;
 }else if(command==='regression-report'){
  if(!input)throw Error('Usage: regression-report generated-project [--limit 20] [--knowledge-home folder]');
  const G=require('./regression-intelligence').open(input,{home:option('knowledge-home')||undefined});
  console.log(JSON.stringify(G.report({limit:Number(option('limit','20'))}),null,2));
 }else if(command==='runtime-import'){
  if(!input)throw Error('Usage: runtime-import generated-project [--checkpoint legacy] [--knowledge-home folder]');
  const R=require('./runtime-evidence-vault').open(input,{home:option('knowledge-home')||undefined});
  const e=R.importExisting({checkpoint:option('checkpoint','historical-import')});
  console.log(JSON.stringify({id:e.id,status:e.status,artifacts:e.artifacts.map(x=>x.path)},null,2));
 }else if(command==='runtime-report'){
  if(!input)throw Error('Usage: runtime-report generated-project [--knowledge-home folder]');
  const R=require('./runtime-evidence-vault').open(input,{home:option('knowledge-home')||undefined});
  console.log(JSON.stringify(R.report({limit:Number(option('limit','20'))}),null,2));
 }else if(command==='corrections-capture'){
  if(!input||!option('baseline')||!option('evidence'))throw Error('Usage: corrections-capture corrected-project --baseline clean-project --evidence test-log.txt --verified [--knowledge-home folder]');
  const registry=require('./cpp-corrections-vault').open(input,{home:option('knowledge-home')||undefined});
  const result=registry.capture({baseline:option('baseline'),evidence:option('evidence'),verified:args.includes('--verified'),notes:option('notes','')});
  console.log(JSON.stringify(result,null,2));
 }else if(command==='corrections-replay'){
  if(!input)throw Error('Usage: corrections-replay generated-project [--apply] [--knowledge-home folder]');
  const registry=require('./cpp-corrections-vault').open(input,{home:option('knowledge-home')||undefined});
  const result=registry.replay({apply:args.includes('--apply')});
  if(result.applied){const changed={};for(const r of result.results)if(r.status==='applied')changed[r.file]=fs.readFileSync(path.join(input,...r.file.split('/')));if(fs.existsSync(path.join(input,'forja65-build-manifest.txt')))refreshManifest(input,changed);}
  console.log(JSON.stringify(result,null,2));
 }else if(command==='vault-status'){
  if(!input)throw new Error('Usage: vault-status game.sfc [--knowledge-home folder]');
  const raw=fs.readFileSync(input),rom=C.loadRom(new Uint8Array(raw),path.basename(input));
  const {instance}=require('./knowledge-vault'),v=instance(rom,raw,{home:option('knowledge-home')||undefined}),k=v.load({isCompatible:require('./project-io').isAuditedCacheVersion});
  console.log(JSON.stringify({path:v.folder,rom:v.id,revision:k.manifest.revision,hints:C.parseRuntimeHints(k.hints).length,knowledgeEntries:k.knowledge?.entries?.length||0,compatibleCfg:k.cache?.functions?.length||0,archivedCfg:k.manifest.cacheCandidates.length,legacyCfg:k.oldCache?.functions?.length||0,errors:k.errors},null,2));
 }else if(command==='import-replay'){
  if(!input||!option('integration')||!option('knowledge')||!option('trace')||!option('error'))throw new Error('Usage: import-replay game.sfc --integration integration.json --knowledge native-knowledge.json --trace forja65-crash-trace.txt --error forja65-last-error.txt [--prior-trace earlier-crash-trace.txt --prior-error earlier-last-error.txt] [--state-log forja65-unresolved-state.txt] [--followup-trace new-crash-trace.txt --followup-error new-last-error.txt] --out crossfeed');
  const {makeCrossfeed}=require('./cross-project-replay');
  const result=makeCrossfeed({romBytes:fs.readFileSync(input),integration:jsonFile(option('integration')),knowledge:jsonFile(option('knowledge')),traceText:fs.readFileSync(option('trace'),'utf8'),stateText:option('state-log')?fs.readFileSync(option('state-log'),'utf8'):null,priorTraceText:option('prior-trace')?fs.readFileSync(option('prior-trace'),'utf8'):null,errorText:fs.readFileSync(option('error'),'utf8'),priorErrorText:option('prior-error')?fs.readFileSync(option('prior-error'),'utf8'):null,followupTraceText:option('followup-trace')?fs.readFileSync(option('followup-trace'),'utf8'):null,followupErrorText:option('followup-error')?fs.readFileSync(option('followup-error'),'utf8'):null});
  const out=path.resolve(option('out','forja-replay-import'));
  writeFiles(out,{'runtime-hints.txt':result.hints,'knowledge-pack.json':JSON.stringify(result.knowledge,null,2)+'\n','report.json':JSON.stringify(result.report,null,2)+'\n'});
  console.log('ROM-bound import: '+out+'; observations '+result.report.imported_runtime_observations+'; catalog '+result.report.static_catalog_entries+' static entries; no equivalence assumed.');
 }else if(command==='cross-analyze'){
  if(!input||!option('knowledge'))throw new Error('Usage: cross-analyze game.sfc --knowledge pack.json --out analysis');
  const rom=loadRom(input),hash=C.romFingerprint(rom),pack=C.normalizeKnowledgePack(jsonFile(option('knowledge')),hash),base=option('profile')?jsonFile(option('profile')):{},profile=C.mergeKnowledgeProfile(base,pack,hash),a=C.analyze(rom,Number(option('max','65536')),[],{knowledge:pack,knowledgeSeedLimit:Number(option('seed-limit','512')),summaryRounds:Number(option('summary-rounds','3'))}),map=C.buildNativeMap(rom,a,null,profile),out=path.resolve(option('out','forja-crossfeed'));
  const summary={schema:'forja65.crossfeed-analysis.v1',rom:hash,version:C.VERSION,knowledge:{entries:pack.entries.length,seedsImported:a.knowledgeSeedsImported||0,dataSeedsRejected:a.knowledgeDataSeedsRejected||0,adjacentDataStops:a.knowledgeAdjacentDataStops||0,dataRegions:pack.dataRegions.length,dispatch:pack.dispatch.length},analysis:{decoded:a.decoded,native:a.native,partial:a.partial,unsupported:a.unsupported,cfgFunctions:a.cfgFunctions,cfgFunctionVariants:a.cfgFunctionVariants,cfgCalls:a.cfgCalls,stateVariantAddressCount:a.stateVariantAddressCount,issues:issueCounts(a)},limits:['Knowledge seeds expand discovery; they do not prove runtime execution or native equivalence.','Categories/names from an external pack are labels, not inferred behavior.']};
  writeFiles(out,{'function-analysis.json':JSON.stringify(a,null,2)+'\n','native-map.json':JSON.stringify(map,null,2)+'\n','crossfeed-summary.json':JSON.stringify(summary,null,2)+'\n','merged-profile.json':JSON.stringify(profile,null,2)+'\n'});
  console.log('Cross analysis: '+out+'; seeds '+summary.knowledge.seedsImported+'/'+summary.knowledge.entries+'; decoded '+a.decoded+'; CFG functions '+a.cfgFunctions+'.');
 }else if(command==='focus-analyze'){
  if(!input||!option('knowledge')||!option('addresses'))throw new Error('Usage: focus-analyze game.sfc --knowledge pack.json --addresses B2802D,B2804B --out analysis');
  const rom=loadRom(input),pack=jsonFile(option('knowledge')),addresses=option('addresses').split(',').map(x=>x.trim()).filter(Boolean),focus=C.focusAnalyze(rom,addresses,pack,{maxPerTarget:Number(option('max-per-target','2048'))}),out=path.resolve(option('out','forja-focus'));
  const returned={schema:'forja65.knowledge-return.v1',version:C.VERSION,rom:focus.rom,entries:focus.results.map(r=>({address:r.address,name:r.name,category:r.category,category_source:r.category_source,family:r.family,direct_jump_sources:r.direct_jump_sources,evidence:['Forja65 focused static CFG/family analysis']})),dispatch:focus.results.flatMap(r=>(r.indirect_sites||[]).filter(s=>s.targets&&s.targets.length).map(s=>({site:s.pc,targets:s.targets,source:'forja65-focus-static-candidates',resolution:s.resolution}))),limits:focus.limits};
  writeFiles(out,{'focus-analysis.json':JSON.stringify(focus,null,2)+'\n','knowledge-return.json':JSON.stringify(returned,null,2)+'\n'});
  console.log('Focus analysis: '+out+'; targets '+focus.results.length+'; '+focus.results.map(r=>'$'+C.hex(r.address,6)+'='+r.category+'('+r.category_source+')').join(', '));
 }else if(command==='native-dispatch'){
  if(!input||!option('knowledge')||!option('site'))throw new Error('Usage: native-dispatch game.sfc --knowledge pack.json --site B9A157 [--proofs handler-equivalence.json] --out generated');
  const rom=loadRom(input),pack=jsonFile(option('knowledge')),proofs=option('proofs')?jsonFile(option('proofs')):null,plan=C.nativeDispatchPlan(rom,option('site'),pack,{maxPerTarget:Number(option('max-per-target','2048')),handlerMax:Number(option('handler-max','2048')),handlerProofs:proofs}),out=path.resolve(option('out','forja-native-dispatch')),ns=option('namespace','forja65_generated');
  writeFiles(out,{'native-dispatch.json':JSON.stringify(plan,null,2)+'\n','native_dispatch.generated.hpp':C.nativeDispatchCpp(plan,{namespace:ns})});
  const cov=plan.cutover.structural_script_hit_coverage||{};const impact=cov.available?('; proven '+plan.cutover.semantic_handlers_proven+'/'+plan.unique_targets+'; structural hits '+cov.native_hits+'/'+cov.total_hits+' ('+(cov.native_fraction*100).toFixed(1)+'%)'):('; proven '+plan.cutover.semantic_handlers_proven+'/'+plan.unique_targets);
  const cb=plan.callback_cutover||{};
  let cbImpact='';
  if(cb.available){
   cbImpact='; callbacks '+cb.semantic_callbacks_proven+'/'+cb.total_callbacks+'; callback hits '+cb.native_hits+'/'+cb.total_hits+' ('+(cb.native_fraction*100).toFixed(1)+'%)';if(cb.dependency_boundary_callbacks)cbImpact+='; callback boundaries '+cb.dependency_boundary_callbacks+'/'+cb.dependency_boundary_hits+' hits; native-or-boundary '+cb.native_or_boundary_hits+'/'+cb.total_hits+' ('+(cb.native_or_boundary_fraction*100).toFixed(1)+'%)';
   if(cov.available&&Number.isFinite(cov.native_plus_callback_fraction))cbImpact+='; effective static hits '+cov.native_plus_callback_hits+'/'+cov.total_hits+' ('+(cov.native_plus_callback_fraction*100).toFixed(1)+'%)';
  }
  const leaf=plan.external_leaf_cutover||{};if(leaf.available){cbImpact+='; external leaves '+leaf.semantic_leaves_proven+'/'+leaf.total_leaves+'; leaf hits '+leaf.native_hits+'/'+leaf.total_hits+' ('+(leaf.native_fraction*100).toFixed(1)+'%)';if(cov.available&&Number.isFinite(cov.native_plus_callback_plus_external_leaf_fraction))cbImpact+='; effective+leaf '+cov.native_plus_callback_plus_external_leaf_hits+'/'+cov.total_hits+' ('+(cov.native_plus_callback_plus_external_leaf_fraction*100).toFixed(1)+'%)';}
  const inv=plan.handler_inventory||{},units=inv.semantic_units||{};if(Number.isFinite(units.total))cbImpact+='; semantic units '+units.semantic_proven+'/'+units.total;
  console.log('Native dispatch plan: '+out+'; site $'+C.hex(plan.site,6)+'; entries '+plan.table_entries+'; unique targets '+plan.unique_targets+'; handler cutover '+(plan.cutover.handler_execution_ready?'ready':'fallback-required')+impact+cbImpact+'.');
 }else if(command==='import-knowledge'){
  if(!input||!option('rom'))throw new Error('Usage: import-knowledge pack.json --rom game.sfc --out game_config.json');
  const rom=loadRom(option('rom')),hash=C.romFingerprint(rom),pack=C.normalizeKnowledgePack(jsonFile(input),hash),base=option('base')?jsonFile(option('base')):{},profile=C.mergeKnowledgeProfile(base,pack,hash),out=path.resolve(option('out','game_config.json'));
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(profile,null,2)+'\n');console.log('Knowledge profile: '+out+'; '+Object.keys(profile.symbols).length+' symbols.');
 }else if(command==='export-knowledge'){
  if(!input)throw new Error('Generated project path required');const project=path.resolve(input),map=jsonFile(path.join(project,'analysis/native-map.json')),pack=C.knowledgePackFromNativeMap(map,{version:C.VERSION}),out=path.resolve(option('out',path.join(project,'analysis/knowledge-export.json')));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(pack,null,2)+'\n');console.log('Knowledge export: '+out+'; '+pack.entries.length+' entries.');
 }else if(command==='migrate-smw-cfg'){
  if(!input)throw new Error('Usage: migrate-smw-cfg project [--max 65536] [--cache-limit 32768] [--recover-legacy-seeds] [--recover-internal-frontiers] [--internal-passes 1..64] [--budget-ceiling N] [--apply]');
  const result=require('./migrate-smw-cfg-cache').run({project:path.resolve(input),max:option('max')??undefined,'cache-limit':option('cache-limit')??undefined,recoverLegacySeeds:args.includes('--recover-legacy-seeds'),recoverInternalFrontiers:args.includes('--recover-internal-frontiers'),internalPassLimit:option('internal-passes')??undefined,budgetCeiling:option('budget-ceiling')??undefined,apply:args.includes('--apply')});
  console.log(JSON.stringify(result,null,2));
  if(result.status==='BLOCKED')process.exitCode=3;
 }else if(command==='learn-crash'){
  if(!input)throw new Error('Usage: learn-crash project --from diagnostic-directory [--max 8192]');
  const project=path.resolve(input),diagnostics=path.resolve(option('from',path.join(project,'build-debug-fast')));
  const romPath=path.join(project,'assets/cart-data.bin'),rom=loadRom(romPath),hash=C.romFingerprint(rom);
  const hintsPath=path.join(project,'analysis/runtime-hints.txt');
  const read=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8'):'';
  const observed=C.mergeRuntimeHints(read(path.join(diagnostics,'forja65-oracle-hints.txt')),read(path.join(diagnostics,'forja65-runtime-hints.txt')));
  const incoming=C.parseRuntimeHints(observed);
  if(!incoming.length)throw new Error('No runtime hints in '+diagnostics);
  if(incoming.some(h=>h.rom!==hash))throw new Error('Refusing hints from different ROM fingerprint: '+hash);
  const stackReturnObservationsVerified=require('./observed-stack-return').verifyObservedStackReturns(rom,incoming,read(path.join(diagnostics,'forja65-unresolved-returns.txt')));
  const previous=read(hintsPath),all=C.parseRuntimeHints(C.mergeRuntimeHints(previous,observed));
  const {romHints,nonRomHints}=require('./rom-executable-hints').partitionExecutableHints(rom,all);
  const merged=C.formatRuntimeHints(romHints);
  const before=C.parseRuntimeHints(previous).filter(h=>C.isRomAddress(rom,h.target)).length,after=romHints.length;
  if(nonRomHints.length){
    const reportPath=path.join(project,'reports/nonrom-execution-targets.json');
    fs.mkdirSync(path.dirname(reportPath),{recursive:true});
    fs.writeFileSync(reportPath,JSON.stringify({schema:1,rom:hash,untranslated_targets:nonRomHints.map(h=>({target:'0x'+C.hex(h.target,6),from:h.from===null?null:'0x'+C.hex(h.from,6),kind:h.kind})),reason:'Static ROM CFG cannot translate executable WRAM/IO/SRAM code; dynamic CPU execution or an evidence-backed native implementation is required.'},null,2)+'\n');
  }
  if(after===before){
    throw new Error('No new ROM-executable hints. '+nonRomHints.length+' non-ROM target(s) need dynamic execution; see reports/nonrom-execution-targets.json.');
  }
  // Do not persist newly learned hints until ROM/CFG regeneration succeeds.
  // A rejected cache, invalid option or generated-source failure must not
  // poison the next replay with uncompiled, unverified permanent hints.
  const max=Number(option('max','8192'));
  const oldHintsExisted=fs.existsSync(hintsPath);
  let generated;
  try {
    // Stage ROM-verified recovery first. Existing large ports may contain far
    // more CPU handlers and newer PPU code than a fresh CFG traversal emits.
    require('./coverage-guard').preflightLearnCrash(project,romPath,max,merged);
    generated=generate({romPath,out:project,max,hints:merged,update:true});
  } catch(error) {
    // Generation may have failed after its first file write. Restore the
    // original verified hints even in that partial-output scenario.
    if(oldHintsExisted)fs.writeFileSync(hintsPath,previous);
    else fs.rmSync(hintsPath,{force:true});
    throw error;
  }
  fs.mkdirSync(path.dirname(hintsPath),{recursive:true});fs.writeFileSync(hintsPath,merged+'\n');
  const report={schema:1,rom:hash,version:C.VERSION,from:diagnostics,existingHints:before,totalHints:after,importedHints:after-before,stackReturnObservationsVerified,max,decoded:generated.a.decoded,changedFiles:generated.changed.length,limit:'CFG discovery only; generated C++ not executed'};
  fs.mkdirSync(path.join(project,'reports'),{recursive:true});fs.writeFileSync(path.join(project,'reports/learn-crash.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Learned '+(after-before)+' verified hint(s), CFG decoded '+generated.a.decoded+'; changed '+generated.changed.length+' files. Compile and run to prove behavior.');
 }else if(command==='interpreter-seeds'){
  if(!input)throw new Error('Usage: interpreter-seeds project --report forja65-cpu-interpreter.txt');
  const proj=path.resolve(input), report=option('report',path.join(proj,'forja65-cpu-interpreter.txt'));
  const out=option('out',path.join(proj,'analysis','r7-interpreter-seeds.txt'));
  require('./interpreter-seeds-r7').run(['--rom',path.join(proj,'assets','cart-data.bin'),'--report',report,'--out',out,'--json',path.join(proj,'reports','R7-INTERPRETER-SEEDS.json'),'--max',option('max','512')]);
 }else if(command==='converge'){
  if(!input)throw new Error('Generated project path required');const project=path.resolve(input);const result=require('./converge').converge(project,{jobs:option('jobs','4'),frames:option('frames','300'),rounds:option('rounds','32'),max:option('max'),watchdog:option('watchdog','50000000'),timeout:option('timeout-ms','120000'),replay:option('replay'),buildDir:option('build-dir'),cacheLimit:option('cache-limit'),ppuTrace:args.includes('--ppu-trace')});console.log('Convergence: '+result.status+'; report: '+path.join(project,'reports/convergence-report.json'));if(result.status!=='PASS')process.exitCode=3;
 }else if(command==='trace'){
  if(!input)throw new Error('Generated project path required');const project=path.resolve(input);configure(project,true);const build=path.join(project,'build');const candidates=[path.join(build,'Release','game.exe'),path.join(build,'game.exe'),path.join(build,'game')];const exe=candidates.find(p=>fs.existsSync(p));if(!exe)throw new Error('Game executable missing');const tracePath=path.join(project,'forja-trace.csv');run(exe,[],{cwd:build,env:{...process.env,FORJA65_TRACE:tracePath,FORJA65_TRACE_LIMIT:option('limit','250000'),FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:option('frames','120'),FORJA65_EXECUTION:option('execution','reference')}});const trace=C.parseTrace(fs.readFileSync(tracePath,'utf8'));const meta=jsonFile(path.join(project,'analysis.json'));const rom=C.loadRom(new Uint8Array(fs.readFileSync(path.join(project,'assets/cart-data.bin'))));const a=jsonFile(path.join(project,'analysis/function-analysis.json'));a.romFingerprint=a.rom;const p=jsonFile(path.join(project,'profiles/game_config.json'));const map=C.buildNativeMap(rom,a,trace,p);if(meta.rom_fingerprint!==map.rom)throw new Error('Project ROM mismatch');const updated={'analysis/native-map.json':JSON.stringify(map,null,2),'analysis/native-map.md':C.nativeMapMarkdown(map),'analysis/trace.json':C.exportTrace(trace.events,'json',trace),'analysis/trace.txt':C.exportTrace(trace.events,'txt',trace),'reports/compatibility-report.json':JSON.stringify(C.compatibilityReport(map,a),null,2),'reports/compatibility-report.md':C.nativeMapMarkdown(map)};writeFiles(project,updated);refreshManifest(project,updated);console.log('Trace: '+trace.events.length+' records; '+trace.dropped+' dropped. Native map updated.');
 }else if(command==='import-trace'){
  if(!input||!option('rom'))throw new Error('Usage: import-trace trace.csv --rom game.sfc');const rom=loadRom(option('rom')),a=C.analyze(rom,65536),trace=C.parseTrace(fs.readFileSync(input,'utf8')),profile=option('profile')?jsonFile(option('profile')):{},map=C.buildNativeMap(rom,a,trace,profile);writeFiles(path.resolve(option('out','forja-analysis')),{'native-map.json':JSON.stringify(map,null,2),'native-map.md':C.nativeMapMarkdown(map),'trace.json':C.exportTrace(trace.events,'json',trace),'trace.txt':C.exportTrace(trace.events,'txt',trace)});
 }else if(command==='compare'){
  const other=option('native');if(!input||!other)throw new Error('Usage: compare reference-hashes.txt --native native-hashes.txt');const result=C.firstDivergence(fs.readFileSync(input,'utf8'),fs.readFileSync(other,'utf8')),out=path.resolve(option('out','first-divergence.json'));fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.equivalent)process.exitCode=3;
 }else if(command==='spc-aot'){
  // REV143: gera src/spc700_native.cpp de um port a partir de capturas de ARAM e do aprendizado por execucao.
  if(!input)throw new Error('Usage: spc-aot port-dir --capture dir[,dir2] [--learn pasta-FORJA65_SPC_AOT_LEARN[,outra]] [--max 65536]');
  const port=path.resolve(input),caps=[],profiles=[];
  const capFiles=d=>fs.existsSync(d+'.bin')?[d+'.bin',d+'.txt']:[path.join(d,'spc-ram.bin'),path.join(d,'spc-capture.txt')];
  for(const d of String(option('capture','')).split(',').filter(Boolean)){const [b,t]=capFiles(path.resolve(d));caps.push(C.loadSpcCapture(new Uint8Array(fs.readFileSync(b)),fs.existsSync(t)?fs.readFileSync(t,'utf8'):''));}
  for(const d of String(option('learn','')).split(',').filter(Boolean)){const dir=path.resolve(d);
   for(const f of fs.readdirSync(dir).filter(f=>/^snap-\d+\.bin$/.test(f)).sort()){const base=path.join(dir,f.slice(0,-4));caps.push(C.loadSpcCapture(new Uint8Array(fs.readFileSync(base+'.bin')),fs.readFileSync(base+'.txt','utf8')));}
   const m=path.join(dir,'spc-aot-misses.txt');if(fs.existsSync(m))profiles.push(fs.readFileSync(m,'utf8'));}
  if(!caps.length)throw new Error('spc-aot: nenhuma captura (use --capture e/ou --learn)');
  const a=C.spcAnalyzeMulti(caps,{max:Number(option('max','65536')),missProfiles:profiles});
  fs.mkdirSync(path.join(port,'src'),{recursive:true});fs.mkdirSync(path.join(port,'analysis'),{recursive:true});
  fs.writeFileSync(path.join(port,'src','spc700_native.cpp'),C.spcCppMulti(a));
  fs.writeFileSync(path.join(port,'analysis','spc700-aot-report.txt'),C.spcMultiReportText(a));
  console.log('SPC AOT: '+a.pcs+' PCs, '+a.decoded+' pares PC/opcode, '+a.learnedRoots+' raizes aprendidas, '+caps.length+' capturas -> '+path.join(port,'src','spc700_native.cpp')+' (recompile o port)');
 }else if(command==='build-native'){
  if(!input)throw new Error('Generated project path required');configure(path.resolve(input),option('trace','off')==='on');console.log('C++ build complete. Translated/hardware fallback remains where not replaced.');
 }else {
  console.log('Forja65 '+C.VERSION+'\nnode tools/forja65.js import-replay game.sfc --integration integration.json --knowledge native-knowledge.json --trace crash-trace.txt --error last-error.txt [--prior-trace earlier-trace.txt --prior-error earlier-error.txt] [--state-log state.txt] [--followup-trace next-trace.txt --followup-error next-error.txt] --out crossfeed\nnode tools/forja65.js hardware-audit --rom game.sfc [--cache-dir folder] [--all-vectors]\nnode tools/forja65.js analyze game.sfc --out project [--hardware-max 32768] [--hardware-reset-only] [--no-hardware-audit] [--cache-limit 32768] [--knowledge knowledge.json] [--knowledge-home folder] [--no-knowledge-vault] [--profile profile.json] [--trace trace.csv]\nnode tools/forja65.js cross-analyze game.sfc --knowledge knowledge.json --out analysis [--seed-limit 512] [--summary-rounds 3]\nnode tools/forja65.js focus-analyze game.sfc --knowledge knowledge.json --addresses B2802D,B2804B --out focus\nnode tools/forja65.js runtime-run project --exec game.exe --frames 120 --min-frames 120 --checkpoint fase [--timeout-ms 120000]\nnode tools/forja65.js runtime-import project [--checkpoint legacy]\nnode tools/forja65.js runtime-report project\nnode tools/forja65.js regression-freeze project --checkpoint scene [--replace] [--allow-lower]\nnode tools/forja65.js regression-check project [--checkpoint scene]\nnode tools/forja65.js regression-report project\nnode tools/forja65.js legacy-import folder-or-zip --rom game.sfc [--apply] [--assume-same-rom] [--deep]\nnode tools/forja65.js legacy-report game.sfc\nnode tools/forja65.js vault-import existing-project [--knowledge-home folder]\nnode tools/forja65.js vault-status game.sfc [--knowledge-home folder]\nnode tools/forja65.js import-knowledge knowledge.json --rom game.sfc --out game_config.json\nnode tools/forja65.js export-knowledge project --out knowledge.json\nnode tools/forja65.js migrate-smw-cfg project [--max 65536] [--cache-limit 32768] [--recover-legacy-seeds] [--recover-internal-frontiers] [--internal-passes 1..64] [--budget-ceiling N] [--apply]\nnode tools/forja65.js converge project --frames 300 [--rounds 32] [--replay input.txt] [--jobs 4] [--cache-limit 131072]\nnode tools/forja65.js trace project --frames 120 [--execution reference|native]\nnode tools/forja65.js import-trace trace.csv --rom game.sfc --out analysis\nnode tools/forja65.js native-dispatch game.sfc --knowledge pack.json --site B9A157 [--proofs handler-equivalence.json] --out generated\nnode tools/forja65.js build-native project [--trace on]');if(command)process.exitCode=2;
 }
}catch(e){console.error('Forja65: '+e.message);process.exitCode=2;}

} // End regular Forja commands; standalone hardware-audit needs no game generator.
