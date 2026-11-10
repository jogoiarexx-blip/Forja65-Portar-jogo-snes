'use strict';
// Reproducible, ROM-bound regression guard. A checkpoint is protected ONLY
// after an explicit freeze of a fresh, source-bound, frame-proven native run.
// Nothing auto-promotes a passing run to a new baseline.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Runtime=require('./runtime-evidence-vault');
const Repairs=require('./cpp-corrections-vault');
const SCHEMA='forja65.regression-intelligence.v1';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const failure=e=>e&&(e.status==='failed'||e.status==='checkpoint-not-reached');
const pass=e=>e&&e.status==='checkpoint-passed'&&Number.isSafeInteger(e.frames)&&e.frames>0&&e.origin==='native-run';
const clean=s=>typeof s==='string'&&s.trim().length&&s.length<=100;
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';try{fs.writeFileSync(tmp,data,{flag:'wx'});fs.renameSync(tmp,file);}finally{try{fs.unlinkSync(tmp);}catch(_){}}}
function open(project,{home}={}){
 const r=Runtime.open(project,{home}),repairs=Repairs.open(project,{home}),file=path.join(r.vault.folder,'regression-intelligence','baselines.json');
 function index(){if(!fs.existsSync(file))return {schema:SCHEMA,rom:r.vault.id,baselines:{},history:[]};const obj=JSON.parse(fs.readFileSync(file,'utf8'));
  if(obj.schema!==SCHEMA||obj.rom?.sha256!==r.vault.id.sha256||obj.rom?.fnv1a64!==r.vault.id.fnv1a64||!obj.baselines||typeof obj.baselines!=='object'||!Array.isArray(obj.history))throw Error('Regression baseline belongs to another ROM or unsupported schema');return obj;}
 function list(){return r.index().events;}
 function latestByCheckpoint(){const map=new Map();for(const e of list())if(e.checkpoint)map.set(e.checkpoint,e);return map;}
 function compare(previous,current,events=list()){
  if(!previous||!current)throw Error('Two runtime events are required');
  if(previous.checkpoint!==current.checkpoint)throw Error('Cannot compare two different checkpoints');
  const prior=events.filter(e=>e.checkpoint===current.checkpoint&&e.id!==current.id&&e.origin==='native-run');
  const oldFailed=failure(previous),newFailed=failure(current);
  let trend='inconclusive';
  if(newFailed){
   if(!current.failureSignature)trend='failure-unclassified';
   else if(prior.some(e=>failure(e)&&e.failureSignature===current.failureSignature)){
    const previousSame=prior.findLast(e=>failure(e)&&e.failureSignature===current.failureSignature);
    const between=events.slice(events.indexOf(previousSame)+1,events.indexOf(current));
    trend=between.some(e=>e.checkpoint===current.checkpoint&&pass(e))?'reopened-failure':'recurring-failure';
   }else trend='new-failure';
  }else if(pass(current)&&oldFailed&&current.frames>=Math.max(previous.minFrames||0,current.minFrames||0))trend='checkpoint-recovered';
  else if(pass(current)&&pass(previous))trend=current.frames>previous.frames?'higher-coverage':current.frames<previous.frames?'lower-coverage':'same-coverage';
  return {checkpoint:current.checkpoint,previous:previous.id,current:current.id,trend,previousStatus:previous.status,currentStatus:current.status,previousFrames:previous.frames,currentFrames:current.frames,signature:current.failureSignature||null,pc:current.failureState?.pc||null};
 }
 function freeze({checkpoint,replace=false,allowLower=false}={}){
  if(!clean(checkpoint))throw Error('Provide a valid --checkpoint (1..100 characters)');
  const all=list(),current=all.filter(e=>e.checkpoint===checkpoint&&e.origin!=='historical-import').at(-1);
  if(!pass(current)||!(current.minFrames>0))throw Error('Latest native run must pass the requested checkpoint and prove positive minFrames before freezing');
  const source=Runtime.sourceFingerprint(r.root);
  if(!source||!current.sourceDigest||source!==current.sourceDigest)throw Error('Source files no longer match the approved runtime evidence; rerun the port before freezing');
  if(!current.executedBinary?.sha256||!current.executedBinary?.path||path.isAbsolute(current.executedBinary.path)||current.executedBinary.path.split('/').includes('..'))throw Error('Executable fingerprint missing; rerun the port');
  const binaryPath=path.join(r.root,...current.executedBinary.path.split('/'));
  if(!fs.existsSync(binaryPath)||!fs.lstatSync(binaryPath).isFile()||Runtime.hashFile(binaryPath)!==current.executedBinary.sha256)throw Error('Executable changed since test; rerun before freezing');
  const i=index(),old=i.baselines[checkpoint];
  if(old&&!replace)throw Error('A baseline already exists; use --replace to explicitly approve a new one');
  if(old&&!allowLower&&(current.frames<old.frames||current.minFrames<old.minFrames))throw Error('Refusing to lower an approved frame target (explicit --allow-lower required)');
  const plans=repairs.plans().repairs,matched=new Set((current.repairCheckpointMatches||[]).map(x=>x.revision));
  const protectedRepairs=plans.filter(p=>matched.has(p.revision)).filter(p=>{
   const f=path.join(r.root,...p.path.split('/'));return fs.existsSync(f)&&fs.lstatSync(f).isFile()&&sha(fs.readFileSync(f))===p.fixedSha256;
  }).map(p=>({path:p.path,sha256:p.fixedSha256,revision:p.revision}));
  const base={checkpoint,eventId:current.id,frames:current.frames,minFrames:current.minFrames,sourceDigest:source,executedBinary:current.executedBinary,protectedRepairs,at:new Date().toISOString(),evidence:'native-run + qa.frames; not full game equivalence'};
  i.baselines[checkpoint]=base;
  i.history.push({at:base.at,checkpoint,eventId:base.eventId,action:old?'replace':'freeze',previousEventId:old?.eventId||null,frames:base.frames,minFrames:base.minFrames,sourceDigest:source});
  atomic(file,Buffer.from(JSON.stringify(i,null,2)+'\n'));
  return {baseline:base,replaced:!!old,historyEntries:i.history.length};
 }
 function check({checkpoint=null,inspectSource=true}={}){
  const i=index(),last=latestByCheckpoint(),names=checkpoint?[checkpoint]:Object.keys(i.baselines).sort();
  if(checkpoint&&!clean(checkpoint))throw Error('Invalid checkpoint');
  const details=names.map(name=>{
   const b=i.baselines[name];if(!b)return {checkpoint:name,status:'no-baseline',reasons:[]};
   const current=last.get(name),reasons=[];
   if(!current)return {checkpoint:name,status:'missing-evidence',baseline:b.eventId,latest:null,reasons:['No runtime evidence for checkpoint']};
   const currentSource=inspectSource?Runtime.sourceFingerprint(r.root):null;
   const sourceChanged=inspectSource&&(!current.sourceDigest||!currentSource||currentSource!==current.sourceDigest);
   if(current.origin==='historical-import')reasons.push('Historical import cannot certify checkpoint');
   if(!pass(current)&&!failure(current))reasons.push('Latest event has no verified frame checkpoint');
   if(failure(current))reasons.push('Native checkpoint failed: '+current.status);
   if(pass(current)&&current.frames<b.frames)reasons.push('Coverage fell from '+b.frames+' to '+current.frames+' frames');
   if(pass(current)&&current.minFrames<b.minFrames)reasons.push('Test required fewer frames than approved baseline');
   const repairsLost=[];
   for(const p of inspectSource?(b.protectedRepairs||[]):[]){const f=path.join(r.root,...p.path.split('/'));const actual=fs.existsSync(f)&&fs.lstatSync(f).isFile()?sha(fs.readFileSync(f)):null;if(actual!==p.sha256)repairsLost.push(p.path);}
   if(repairsLost.length)reasons.push('Approved C++ repair missing or changed: '+repairsLost.join(', '));
   if(sourceChanged)reasons.push('Current source code differs from latest tested build (or no fingerprint)');
   let binaryChanged=false;
   if(inspectSource){const b=current.executedBinary;
    if(!b?.path||!b?.sha256||path.isAbsolute(b.path)||b.path.split('/').includes('..'))binaryChanged=true;
    else{const loc=path.join(r.root,...b.path.split('/'));binaryChanged=!fs.existsSync(loc)||!fs.lstatSync(loc).isFile()||Runtime.hashFile(loc)!==b.sha256;}
    if(binaryChanged)reasons.push('Current executable differs from latest tested binary (or no fingerprint)');
   }
   const hard=failure(current)||repairsLost.length||(pass(current)&&(current.frames<b.frames||current.minFrames<b.minFrames));
   const status=hard?'regression':sourceChanged||binaryChanged||!pass(current)?'inconclusive':current.id===b.eventId?'baseline-current':'protected';
   return {checkpoint:name,status,baseline:b.eventId,latest:current.id,baselineFrames:b.frames,currentFrames:current.frames,reasons,repairsLost,sourceMatchesRun:!sourceChanged};
  });
  return {schema:SCHEMA,rom:r.vault.id,baselineCount:Object.keys(i.baselines).length,regressions:details.filter(x=>x.status==='regression').length,inconclusive:details.filter(x=>x.status==='inconclusive'||x.status==='missing-evidence').length,details};
 }
 function report({limit=20}={}){
  const events=list(),recent=[],size=Math.max(0,Math.min(100,Number(limit)||0));
  for(let j=Math.max(1,events.length-size);j<events.length;j++){
   const cur=events[j],prev=events.slice(0,j).reverse().find(e=>e.checkpoint===cur.checkpoint&&e.origin==='native-run');
   if(prev&&cur.origin==='native-run')recent.push(compare(prev,cur,events));
  }
  const gate=check();
  return {...gate,transitions:recent,freezeHistoryCount:index().history.length};
 }
 return {openRuntime:r,file,index,freeze,check,report,compare};
}
module.exports={open,SCHEMA};
