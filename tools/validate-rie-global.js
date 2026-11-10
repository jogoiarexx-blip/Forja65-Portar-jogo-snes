'use strict';
// Reproducible static/creator comparison. No claim of gameplay validation.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),romPath=path.join(root,'reports/validation-crossfeed-0396/bbab29-integrated/generated/assets/cart-data.bin');
if(process.argv[2]==='worker'){
 const mode=process.argv[3],out=process.argv[4],C=require(mode.startsWith('baseline')?'../crossfeed-historico/v043694-rie-baseline/forja65-core':'../forja65-core'),rom=C.loadRom(fs.readFileSync(romPath)),start=performance.now(),hints=mode.endsWith('cold')?'':fs.readFileSync(path.join(path.dirname(romPath),'../analysis/runtime-hints.txt'),'utf8');let a;
 if(mode.startsWith('baseline')||mode.startsWith('global'))a=C.analyze(rom,2048,C.parseRuntimeHints(hints),{summaryRounds:2,globalCfgRounds:mode.startsWith('global')?1:0});
 else a=require('./project-io').generate({romPath,out,max:2048,hints,update:mode==='update'}).a;
 const pcs=[...new Set(a.functions.flatMap(f=>f.instructions.map(i=>i.pc)))],semantics=[...new Set(a.functions.flatMap(f=>f.instructions.map(i=>JSON.stringify([i.pc,i.stateSig,i.raw]))))];
 console.log(JSON.stringify({mode,version:C.VERSION,rom:C.romFingerprint(rom),decoded:a.decoded,functions:a.functions.length,instructionVariants:a.instructionVariants,milliseconds:performance.now()-start,peakRssKiB:process.resourceUsage().maxRSS,rieGlobal:a.rieGlobal,inventory:a.romInventory&&{cache:a.romInventory.cache,metrics:a.romInventory.metrics},pcs,semantics}));
}else{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rie-real-'));
 try{const runs=[];for(const mode of ['baseline-cold','global-cold','baseline','global','create','update']){const p=spawnSync(process.execPath,[__filename,'worker',mode,dir],{encoding:'utf8',maxBuffer:16*1024*1024,timeout:120000});assert.equal(p.status,0,p.stderr);runs.push(JSON.parse(p.stdout));}
 const [coldBefore,coldAfter,b,g,c,u]=runs;assert(g.decoded>=b.decoded);for(const pair of [[coldBefore,coldAfter],[b,g],[c,u]]){const after=new Set(pair[1].semantics);for(const i of pair[0].semantics)assert(after.has(i),'prior PC/state/raw tuple must be retained');}
 assert(u.decoded>=c.decoded);assert(u.rieGlobal.cacheImport.contextMatched);assert.equal(u.inventory.metrics.physicalBytesScanned,0);
 for(const r of runs){delete r.pcs;delete r.semantics;}const result={schema:'forja65.rie-global-validation.v1',fixture:'DKC3 supplied cart-data.bin',romBytes:fs.statSync(romPath).size,runs,coldGain:coldAfter.decoded-coldBefore.decoded,gain:g.decoded-b.decoded,percentGain:100*(g.decoded-b.decoded)/b.decoded,gameplayValidated:false,notes:['Single-process samples per case; timings include inventory and, for create/update, writing the generated project.','Peak RSS includes Node runtime; not a steady-state memory measurement.','Static addresses and function entries are not gameplay coverage.','All prior PC/state/raw tuples retained in baseline/global and create/update.']};
 fs.writeFileSync(path.join(root,'reports/rie-v043695/dkc3-validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
