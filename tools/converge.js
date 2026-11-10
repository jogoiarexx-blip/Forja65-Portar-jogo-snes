'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),C=require('../forja65-core'),IO=require('./project-io');
const {verifyObservedStackReturns}=require('./observed-stack-return');
const {audit:ppuVisibilityAudit}=require('./ppu-visibility-audit');
// REV136: since REV133, unanalyzed targets run in the fallback interpreter and are logged to
// forja65-cpu-interpreter.txt instead of producing oracle hints. Feed the entries that the
// REV135 validator proves are ROM code back into convergence as ordinary FLOW hints.
function interpreterHints(romPath,romHash,text){
 if(!text)return '';
 const L=require('./learn-from-interpreter'),rows=L.parseLog(text);if(!rows.length)return '';
 return L.learn(C.loadRom(fs.readFileSync(romPath)),rows,romHash).hintsText;
}
// A computed RTS/RTL must have matching observed stack evidence; unguarded
// runtime hints are NOT enough to authorize a new dispatcher target.
function validateNewReturnHints(rom,hints,log){return verifyObservedStackReturns(rom,hints,log);}
function positive(value,name,ceiling){const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>ceiling)throw new Error(name+' must be an integer between 1 and '+ceiling);return n;}
function hintKeys(text){return new Set(C.parseRuntimeHints(text).map(h=>[h.rom,h.target,h.from,h.kind,h.state.emulation,h.state.m8,h.state.x8,h.state.carry].join('|')));}
function qaFields(text){return Object.fromEntries(text.split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));}
function interruptedExecution(result){
 if(!result.signal)return null;
 return result.signal==='SIGINT'||result.signal==='SIGTERM'?'EXECUTION_INTERRUPTED':'EXECUTION_SIGNAL';
}
// A supplied incremental CMake build may intentionally use MinSizeRel, Debug,
// PCH or different trace flags. Reconfiguring it as Release forces a full
// recompilation of every generated shard even when only one CFG edge changed.
function cmakeConfigureArgs(project,build){
 const args=['-S',project,'-B',build];
 if(!fs.existsSync(path.join(build,'CMakeCache.txt')))
  args.push('-DCMAKE_BUILD_TYPE=Release','-DFORJA65_ENABLE_TRACE=OFF');
 return args;
}
// An interrupted compiler/linker may leave a zero-byte file with a fresh mtime.
// CMake then treats it as up-to-date. Invalidate only empty compiled outputs.
function removeEmptyBuildOutputs(build){
 const removed=[];if(!fs.existsSync(build))return removed;
 const visit=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,e.name);if(e.isDirectory())visit(p);
  else if(e.isFile()&&(/\.(?:o|obj)$/.test(e.name)||/^game(?:\.exe)?$/.test(e.name))&&fs.statSync(p).size===0){fs.unlinkSync(p);removed.push(path.relative(build,p));}
 }};visit(build);return removed;
}
function converge(project,{frames=300,rounds=32,max=null,watchdog=50000000,timeout=120000,replay=null,buildDir=null,ppuTrace=false,jobs=4,cacheLimit=null}={}){
 project=path.resolve(project);
 // Reuse the generation budget originally chosen for this project. Raising it
 // implicitly during convergence can evict previously compiled CFG variants.
 if(max===null||max===undefined){
  const options=path.join(project,'analysis/generation-options.json');
  max=fs.existsSync(options)?JSON.parse(fs.readFileSync(options,'utf8')).max:65536;
 }
 if(cacheLimit!==null&&cacheLimit!==undefined)cacheLimit=positive(cacheLimit,'cache-limit',1000000);
 jobs=positive(jobs,'jobs',32);frames=positive(frames,'frames',1000000);rounds=positive(rounds,'rounds',256);max=positive(max,'max',1000000);watchdog=positive(watchdog,'watchdog',1000000000);timeout=positive(timeout,'timeout-ms',3600000);
 const romPath=path.join(project,'assets/cart-data.bin');if(!fs.existsSync(romPath))throw new Error('Generated project ROM is missing.');if(replay){replay=path.resolve(replay);if(!fs.existsSync(replay))throw new Error('Replay file is missing.');}
 const build=buildDir?(path.isAbsolute(buildDir)?path.normalize(buildDir):path.resolve(project,buildDir)):path.join(project,'build');
 const report={schema:1,version:C.VERSION,rom:C.romFingerprint(C.loadRom(fs.readFileSync(romPath))),requestedFrames:frames,execution:'reference',replay:replay?path.basename(replay):null,status:'RUNNING',rounds:[]};
 report.generationBudget=max;report.cacheLimit=cacheLimit===null?(fs.existsSync(path.join(project,'analysis/generation-options.json'))?(JSON.parse(fs.readFileSync(path.join(project,'analysis/generation-options.json'),'utf8')).cacheLimit??32768):32768):cacheLimit;report.buildDirectory=path.relative(project,build)||'.';report.ppuTrace=!!ppuTrace;report.buildJobs=jobs;
 const archive=path.join(project,'reports/convergence');fs.mkdirSync(archive,{recursive:true});const reportDir=fs.mkdtempSync(path.join(archive,'session-'));report.session='reports/convergence/'+path.basename(reportDir);
 const save=()=>{const changed={'reports/convergence-report.json':JSON.stringify(report,null,2)+'\n'};IO.writeFiles(project,changed);IO.refreshManifest(project,changed);};
 const tool=(exe,params,log)=>{const result=cp.spawnSync(exe,params,{encoding:'utf8',timeout:600000});fs.appendFileSync(log,(result.stdout||'')+(result.stderr||''));if(result.error||result.status!==0)throw new Error(exe+' failed: '+(result.error?.message||result.status));};
 try{
  for(let i=1;i<=rounds;i++){
   const prefix=String(i).padStart(3,'0'),log=path.join(reportDir,prefix+'-build.log');fs.writeFileSync(log,'');
   
   console.log('Convergence '+i+'/'+rounds+': generate/build/run '+frames+' frames.');
   const generated=IO.generate({romPath,out:project,max,update:true,cacheLimit});
   const invalidated=removeEmptyBuildOutputs(build);if(invalidated.length)fs.appendFileSync(log,'Invalidated empty build outputs: '+invalidated.join(', ')+'\n');
   tool('cmake',cmakeConfigureArgs(project,build),log);
   tool('cmake',['--build',build,'--config','Release','--target','game','-j',String(jobs)],log);
   const exe=['Release/game.exe','game.exe','game'].map(p=>path.join(build,p)).find(p=>fs.existsSync(p));if(!exe)throw new Error('Game executable missing.');
   const cwd=path.join(reportDir,prefix+'-run');fs.mkdirSync(cwd,{recursive:true});fs.cpSync(path.join(project,'assets'),path.join(cwd,'assets'),{recursive:true});
   // Fresh directories isolate append-only diagnostics and save state on every attempt.
   const result=cp.spawnSync(exe,[],{cwd,encoding:'utf8',timeout,env:{...process.env,FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:String(frames),FORJA65_WATCHDOG_INSTRUCTIONS:String(watchdog),FORJA65_EXECUTION:'reference',FORJA65_ROM_MODE:'cart',FORJA65_TRACE:'',FORJA65_FRAME_HASHES:'1',FORJA65_PPU_TRACE:ppuTrace?'1':'',FORJA65_INPUT_RECORD:'',FORJA65_INPUT_REPLAY:replay||''}});
   fs.writeFileSync(path.join(cwd,'stdout.log'),(result.stdout||'')+(result.stderr||''));
   const observed=C.mergeRuntimeHints(C.mergeRuntimeHints(IO.readOptional(path.join(cwd,'forja65-oracle-hints.txt')),IO.readOptional(path.join(cwd,'forja65-runtime-hints.txt'))),interpreterHints(romPath,report.rom,IO.readOptional(path.join(cwd,'forja65-cpu-interpreter.txt')))),old=hintKeys(generated.hints),newHints=C.parseRuntimeHints(observed).filter(h=>!old.has([...hintKeys(C.formatRuntimeHints([h]))][0]));
   const qa=qaFields(IO.readOptional(path.join(cwd,'forja65-qa-status.txt'))),crash=IO.readOptional(path.join(cwd,'forja65-crash-trace.txt')),crashFrame=crash.match(/^frame=(\d+)/m),item={round:i,exitCode:result.status,signal:result.signal,error:result.error?.message||qa.error||null,frames:Number(qa.frames||(crashFrame&&crashFrame[1])||0),newHints:newHints.length,changedFiles:generated.changed.length,qa,run:report.session+'/'+prefix+'-run'};report.rounds.push(item);
   if(ppuTrace){
    const timeline=IO.readOptional(path.join(cwd,'forja65-ppu-timeline.csv'));
    if(timeline){const a=ppuVisibilityAudit(timeline);item.ppu={sampledFrames:a.sampledFrames,first:a.first,counts:a.counts,intervals:a.intervals};}
    else item.ppu={sampledFrames:0,warning:'No PPU timeline emitted by this executable'};
   }
   if(result.error){report.status='EXECUTION_ERROR';save();return report;}
   // A cancelled/crashed child may have emitted hints before termination.
   // Keep those diagnostics, but never regenerate/restart a signalled run.
   const interrupted=interruptedExecution(result);
   if(interrupted){report.status=interrupted;save();return report;}
   if(result.status===0&&qa.runtime_started==='PASS'&&item.frames>=frames){report.status='PASS';save();return report;}
   if(!newHints.length){report.status=result.status===0?'INCOMPLETE':'BLOCKED';save();return report;}
   // Accept only observations with the exact ROM fingerprint from this run.
   if(newHints.some(h=>h.rom!==report.rom))throw new Error('Observed runtime hints have an invalid ROM fingerprint.');
   // Do not poison an accumulated CFG with a synthetic or tampered stack return.
   // Every computed return is checked against the current ROM and a matching
   // runtime stack-mismatch record generated in this isolated run directory.
   try { item.verifiedStackReturns=validateNewReturnHints(
    C.loadRom(fs.readFileSync(romPath)),newHints,
    IO.readOptional(path.join(cwd,'forja65-unresolved-returns.txt'))
   ); } catch(e) { report.status='UNVERIFIED_STACK_RETURN';item.stackEvidenceError=e.message;save();return report; }
   const accumulated=C.mergeRuntimeHints(generated.hints,C.formatRuntimeHints(newHints));
   IO.writeFiles(project,{'analysis/runtime-hints.txt':accumulated+'\n'});IO.refreshManifest(project,{'analysis/runtime-hints.txt':accumulated+'\n'});
   save();console.log('Learned '+newHints.length+' new state/flow hint(s) at frame '+item.frames+'.');
  }
  report.status='ROUND_LIMIT';save();return report;
 }catch(error){report.status='BUILD_OR_GENERATION_ERROR';report.error=error.message;save();throw error;}
}
module.exports={converge,positive,validateNewReturnHints,cmakeConfigureArgs,removeEmptyBuildOutputs,interruptedExecution};
