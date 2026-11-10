'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
if(process.argv[2]==='worker'){
 const IO=require(process.argv[7]==='old'?'../crossfeed-historico/v043697-rie-baseline/tools/project-io':'./project-io'),out=process.argv[3],file=process.argv[4],max=Number(process.argv[5]),on=process.argv[6]==='on',update=fs.existsSync(path.join(out,'analysis/cfg-coverage-cache.json'));
 const old=update?JSON.parse(fs.readFileSync(path.join(out,'analysis/cfg-coverage-cache.json'),'utf8')):null,tuples=a=>new Set(a.functions.flatMap(f=>f.instructions.map(i=>i.pc+'|'+i.stateKey+'|'+i.raw.join(',')))),prior=old?tuples(old):new Set(),start=performance.now(),result=IO.generate({romPath:file,out,max,globalCfgRounds:0,internalReplay:on,update}),elapsed=(performance.now()-start)/1000;
 const now=tuples(result.a);for(const k of prior)if(!now.has(k))throw new Error('Coverage lost '+k);
 const pcs=[...new Set(result.a.functions.flatMap(f=>f.instructions.map(i=>i.pc)))].sort((a,b)=>a-b);const report=fs.existsSync(path.join(out,'analysis/internal-replay.json'))?JSON.parse(fs.readFileSync(path.join(out,'analysis/internal-replay.json'),'utf8')):{enabled:false};const memory=JSON.parse(fs.readFileSync(path.join(out,'analysis/persistent-analysis.json'),'utf8'));
 process.stdout.write(JSON.stringify({seconds:elapsed,maxRssMiB:process.resourceUsage().maxRSS/1024,decoded:result.a.decoded,variants:result.a.cfgCacheUniqueInstructionVariants,functions:result.a.functions.length,newStateByteTuples:now.size-prior.size,lost:0,replay:report,memo:memory.memo,pcs,inventory:memory.coverage}));
}else{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-internal-bench-')),C=require('../forja65-core');
 try{
  const bytes=C.makeSyntheticRom();bytes.fill(0xea,0,128);bytes[128]=0xdb;const synthetic=path.join(dir,'linear.sfc');fs.writeFileSync(synthetic,bytes);
  function run(label,file,max,on,old=false){const p=cp.spawnSync(process.execPath,[__filename,'worker',path.join(dir,label),file,String(max),on?'on':'off',old?'old':'current'],{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});if(p.status!==0)throw new Error(p.stderr||p.stdout);return JSON.parse(p.stdout);}
  const linear=[];for(let n=0;n<8;n++){const on=run('linear-on',synthetic,16,true),off=run('linear-off',synthetic,16,false);linear.push({iteration:n,on,off});}
  const cart=path.join(root,'reports/validation-crossfeed-0396/bbab29-integrated/generated/assets/cart-data.bin'),dkc3=[];
  for(let n=0;n<4;n++){const on=run('dkc3-on',cart,512,true),off=run('dkc3-off',cart,512,false),a=new Set(on.pcs),b=new Set(off.pcs);dkc3.push({iteration:n,on,off,onOnly:[...a].filter(x=>!b.has(x)).length,offOnly:[...b].filter(x=>!a.has(x)).length});}
  const old=run('upgrade',cart,512,false,true),upgrade=run('upgrade',cart,512,true),next=run('upgrade',cart,512,true);
  process.stdout.write(JSON.stringify({version:C.VERSION,sourceCoreSha256:sha(fs.readFileSync(path.join(root,'forja65-core.js'))),linear,dkc3,upgrade:{old,upgrade,next},romSha256:sha(fs.readFileSync(cart)),limits:['Single samples, no stable speed/RSS guarantee','No commercial gameplay or Windows build','Replay re-decodes prior nodes, bounded at8192 per summary pass','Index/context hints do not prove reachable target execution']},null,2)+'\n');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
