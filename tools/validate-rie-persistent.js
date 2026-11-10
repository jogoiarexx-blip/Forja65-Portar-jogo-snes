'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),cart=path.join(root,'reports/validation-crossfeed-0396/bbab29-integrated/generated/assets/cart-data.bin');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
if(process.argv[2]==='worker'){
 const IO=require(process.argv[6]==='old'?'../crossfeed-historico/v043696-rie-baseline/tools/project-io':'./project-io');
 const core=require(process.argv[6]==='old'?'../crossfeed-historico/v043696-rie-baseline/forja65-core':'../forja65-core');let analyzerCalls=0,analyzerSeconds=0;const analyze=core.analyze;core.analyze=(...args)=>{const t=performance.now();analyzerCalls++;try{return analyze(...args);}finally{analyzerSeconds+=(performance.now()-t)/1000;}};
 const out=process.argv[3],enabled=process.argv[4]==='on',update=process.argv[5]==='update';
 const before=update?JSON.parse(fs.readFileSync(path.join(out,'analysis/cfg-coverage-cache.json'),'utf8')):null,start=performance.now();
 const result=IO.generate({romPath:cart,out,max:2048,globalCfgRounds:1,update,persistentAnalysis:enabled}),seconds=(performance.now()-start)/1000;
 const tuples=a=>new Set(a.functions.flatMap(f=>f.instructions.map(i=>i.pc+'|'+i.stateSig+'|'+i.raw.join(','))));const prior=before?tuples(before):new Set(),now=tuples(result.a);for(const k of prior)if(!now.has(k))throw new Error('Coverage lost: '+k);
 const native=fs.readdirSync(path.join(out,'src')).sort().map(n=>[n,sha(fs.readFileSync(path.join(out,'src',n)))]);
 const m=path.join(out,'analysis/persistent-analysis.json'),record=fs.existsSync(m)?JSON.parse(fs.readFileSync(m,'utf8')):null;
 let diskBytes=0;const folder=path.join(out,'analysis/rie-analysis-cache/snapshots');if(fs.existsSync(folder))for(const n of fs.readdirSync(folder))diskBytes+=fs.statSync(path.join(folder,n)).size;
 process.stdout.write(JSON.stringify({seconds,analyzerCalls,analyzerSeconds,maxRssMiB:process.resourceUsage().maxRSS/1024,decoded:result.a.decoded,functionVariants:result.a.functions.length,newInstructionStates:now.size-prior.size,lost:0,nativeSha256:sha(JSON.stringify(native)),memo:record?.memo||null,cacheDiskBytes:diskBytes,inventory:record?.coverage||null}));
}else{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-persist-bench-')),rows=[];
 try{
  function run(name,flag,update,old=false){const p=cp.spawnSync(process.execPath,[__filename,'worker',path.join(dir,name),flag,update?'update':'create',old?'old':'current'],{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});if(p.status!==0)throw new Error(p.stderr||p.stdout);return JSON.parse(p.stdout);}
  for(let n=0;n<6;n++){const enabled=run('enabled','on',n>0),disabled=run('disabled','off',n>0);if(enabled.nativeSha256!==disabled.nativeSha256)throw new Error('Cache changed generated native code at update '+n);rows.push({iteration:n,enabled,disabled,nativeEqual:true});}
  const old=run('upgrade','off',false,true),upgrade=run('upgrade','on',true);process.stdout.write(JSON.stringify({rom:sha(fs.readFileSync(cart)),mapping:'HiROM',max:2048,globalCfgRounds:1,rows,upgrade:{old,upgraded:upgrade},limitations:['Single samples with concurrent regression suite, not stable performance bounds.','No commercial gameplay or Windows build validated.','Inventory/code/emitter support differ from execution coverage.']},null,2)+'\n');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
