"use strict";
// Persistent, ROM-bound evidence journal for actual native test runs.
// Exit code + frame count prove only the declared checkpoint, never full gameplay.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),zlib=require('node:zlib');
const Repairs=require('./cpp-corrections-vault');
const SCHEMA='forja65.runtime-evidence.v1',MAX_ARTIFACT=2*1024*1024,MAX_CAPTURE=32,MAX_OUTPUT=1024*1024;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function hashFile(file){
 const h=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),chunk=Buffer.allocUnsafe(128*1024);
 try{for(;;){const n=fs.readSync(fd,chunk,0,chunk.length,null);if(!n)break;h.update(chunk.subarray(0,n));}}
 finally{fs.closeSync(fd);}
 return h.digest('hex');
}
const allowed=/^(?:forja65-(?:crash-trace|last-error|qa-status|runtime-hints|oracle-hints|oracle-observations|unresolved-state|unresolved-targets|checkpoint|frame|input-replay|runtime-state|replay|trace)[\w.()_-]*\.(?:txt|log|json|csv|bin)|partida-replay[\w.()_-]*\.txt|forja-trace\.csv)$/i;
const scanDirs=['.','build-win/Release','build/Release','build','bin'];
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';try{fs.writeFileSync(tmp,data,{flag:'wx'});fs.renameSync(tmp,file);}finally{try{fs.unlinkSync(tmp);}catch(_){}}}
function sourceFingerprint(project){
 // Fingerprint all generated C/C++ sources, not the mutable build directory.
 const src=path.join(project,'src'),files=[];
 function walk(dir,rel='',depth=0){
  if(depth>12||files.length>3000)throw Error('Source tree exceeds fingerprint limits');
  if(!fs.existsSync(dir))return;
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
   if(item.isSymbolicLink())continue;
   const name=rel?rel+'/'+item.name:item.name,full=path.join(dir,item.name);
   if(item.isDirectory())walk(full,name,depth+1);
   else if(item.isFile()&&/\.(?:c|cc|cpp|h|hpp)$/i.test(item.name)){
    const st=fs.statSync(full);if(st.size>32*1024*1024)throw Error('Oversized source: '+name);
    files.push([name,sha(fs.readFileSync(full))]);
   }
  }
 }
 walk(src);
 if(!files.length)return null;
 files.sort((a,b)=>a[0].localeCompare(b[0]));
 return sha(Buffer.from(JSON.stringify(files)));
}
function stableFailure({crash='',stderr='',spawnError='',exitCode=null,signal=null,qa={}}={}){
 // Eliminate volatile counters, paths, dates and frame numbers. Preserve CPU
 // addresses and crash causes so repeat incidents can be recognized.
 const raw=String(crash||stderr||spawnError||'').slice(0,12000);
 const causes=[];
 const state={};
 for(const line of raw.split(/\r?\n/).slice(0,160)){
  const m=line.match(/^\s*(?:\[?CPU\]?\s*)?(PC|PBR|DBR|SP|P|OPCODE|TARGET|REASON|ERROR|EXCEPTION|FAULT)\s*[:=]\s*(.{1,160})/i);
  if(m){let value=m[2].trim();if(/^(?:PC|PBR|DBR|SP|TARGET|OPCODE)$/i.test(m[1]))value=value.replace(/^\$/,'').replace(/^0x/i,'').toUpperCase();state[m[1].toLowerCase()]=value.slice(0,90);}
  else if(/(?:fatal|error|assert|exception|access violation|segmentation fault|unresolved|invalid opcode|watchdog|timeout)/i.test(line))causes.push(line.trim().slice(0,180));
 }
 const normalize=t=>String(t).toLowerCase()
  .replace(/\b\d{4}-\d\d-\d\d[t ]\d\d:\d\d:\d\d(?:\.\d+)?z?\b/g,'<date>')
  .replace(/\b(?:frame|frames|cycles|cycle|elapsed|timestamp|ms)\s*[:=]\s*\d+\b/gi,'<counter>')
  .replace(/[a-z]:\\[^\s]+|\/(?:[^\s/:]+\/){2,}[^\s:]*/gi,'<path>')
  .replace(/\b(?:0x)?[a-f0-9]{12,}\b/gi,'<value>')
  .replace(/\s+/g,' ').trim().slice(0,900);
 const normalized=normalize([Object.keys(state).sort().map(k=>k+'='+state[k]).join(';'),...causes.slice(0,4)].filter(Boolean).join(' | ')||raw.split(/\r?\n/).slice(0,8).join(' '));
 const basis=[signal?'signal='+signal:'',spawnError?'spawn='+normalize(spawnError):'',exitCode!==null&&exitCode!==0?'exit='+exitCode:'',normalized?'log='+normalized:'',qa.runtime_started==='FAIL'?'qa-fail':''].filter(Boolean).join('|');
 return {signature:basis?sha(Buffer.from(basis)):null,state,normalized:normalized.slice(0,400)};
}
function open(project,{home}={}){
 const repairs=Repairs.open(project,{home}),root=repairs.root,vault=repairs.vault,folder=path.join(vault.folder,'runtime-evidence'),indexFile=path.join(folder,'index.json');
 function index(){if(!fs.existsSync(indexFile))return {schema:SCHEMA,rom:vault.id,events:[]};const obj=JSON.parse(fs.readFileSync(indexFile,'utf8'));if(obj.schema!==SCHEMA||obj.rom?.sha256!==vault.id.sha256||obj.rom?.fnv1a64!==vault.id.fnv1a64||!Array.isArray(obj.events))throw Error('Runtime evidence ROM/schema mismatch');return obj;}
 function put(b){if(b.length>MAX_ARTIFACT)throw Error('Runtime evidence object too large');const id=sha(b),file=path.join(folder,'objects',id+'.gz');if(!fs.existsSync(file))atomic(file,zlib.gzipSync(b));return id;}
 function snapshot(){const seen=new Map();for(const dir of scanDirs){const abs=path.join(root,dir);if(!fs.existsSync(abs)||!fs.statSync(abs).isDirectory())continue;for(const entry of fs.readdirSync(abs,{withFileTypes:true})){if(!entry.isFile()||entry.isSymbolicLink()||!allowed.test(entry.name))continue;const rel=(dir==='.'?'':dir+'/')+entry.name,full=path.join(abs,entry.name),st=fs.lstatSync(full);if(!st.isFile()||st.size>MAX_ARTIFACT)continue;const bytes=fs.readFileSync(full);seen.set(rel,{sha256:sha(bytes),size:bytes.length,mtimeMs:st.mtimeMs,bytes});}}return seen;}
 function record({before=new Map(),after=snapshot(),exitCode=null,signal=null,spawnError=null,stdout='',stderr='',checkpoint='default',minFrames=0,command=[],origin='native-run',durationMs=0,forcedStatus=null,sourceDigest=null,executedBinary=null}={}){
  if(typeof checkpoint!=='string'||!checkpoint.trim()||checkpoint.length>100)throw Error('Invalid checkpoint name');
  const i=index(),changed=[];for(const [name,entry] of after)if(before.get(name)?.sha256!==entry.sha256||before.get(name)?.mtimeMs!==entry.mtimeMs){if(changed.length>=MAX_CAPTURE)break;changed.push({path:name,sha256:entry.sha256,size:entry.size,object:put(entry.bytes)});}
  const find=(prefix)=>changed.filter(x=>path.basename(x.path).toLowerCase().startsWith(prefix)).sort((a,b)=>b.path.localeCompare(a.path))[0];
  const qaEntry=find('forja65-qa-status'),errEntry=find('forja65-last-error'),crashEntry=find('forja65-crash-trace');
  const qaText=qaEntry?after.get(qaEntry.path).bytes.toString('utf8'):'';
  const qa={};for(const line of qaText.split(/\r?\n/)){const m=line.match(/^([a-z_]+)=(.*)$/);if(m)qa[m[1]]=m[2].slice(0,200);}
  const frames=/^\d+$/.test(qa.frames||'')?Number(qa.frames):null;
  const crash=(crashEntry?after.get(crashEntry.path).bytes.toString('utf8'):'')||(errEntry?after.get(errEntry.path).bytes.toString('utf8'):'');
  let status='completed-unverified';
  if(forcedStatus)status=forcedStatus;
  else if(spawnError||signal||exitCode!==0||errEntry||crashEntry||qa.runtime_started==='FAIL')status='failed';
  else if(minFrames>0&&(frames===null||frames<minFrames))status='checkpoint-not-reached';
  else if(minFrames>0&&frames>=minFrames)status='checkpoint-passed';
  const failure=stableFailure({crash,stderr,spawnError,exitCode,signal,qa});
  const hintFiles=changed.filter(x=>/^forja65-(?:runtime-hints|oracle-hints)/i.test(path.basename(x.path)) && /\.(?:txt|log)$/i.test(x.path));
  let hintsSaved=0;if(hintFiles.length){const hintsText=hintFiles.map(x=>after.get(x.path).bytes.toString('utf8')).join('\n');const result=vault.save({hints:hintsText,origin:'runtime-evidence:'+checkpoint});if(result.changed.includes('hints'))hintsSaved=hintFiles.length;}
  const previous=i.events.filter(x=>x.checkpoint===checkpoint && (x.status==='failed'||x.status==='checkpoint-not-reached'));
  const matchRepairs=[];
  if(status==='checkpoint-passed'){
   const plans=repairs.plans().repairs,byRevision=new Map();
   for(const p of plans){if(!byRevision.has(p.revision))byRevision.set(p.revision,[]);byRevision.get(p.revision).push(p);}
   for(const [revision,group] of byRevision){if(group.every(p=>{const file=path.join(root,...p.path.split('/'));return fs.existsSync(file)&&fs.statSync(file).isFile()&&sha(fs.readFileSync(file))===p.fixedSha256;}))matchRepairs.push({revision,checkpoint,priorFailures:previous.map(x=>x.id)});}
  }
  const stdoutBlob=Buffer.from(String(stdout).slice(0,MAX_OUTPUT),'utf8'),stderrBlob=Buffer.from(String(stderr).slice(0,MAX_OUTPUT),'utf8');
  const event={id:'run-'+String(i.events.length+1).padStart(6,'0'),at:new Date().toISOString(),origin,checkpoint,minFrames,exitCode,signal,spawnError,command:command.map(x=>String(x).slice(0,200)).slice(0,30),durationMs,status,frames,qa,sourceDigest:sourceDigest||sourceFingerprint(root),executedBinary, failureState:status==='failed'?failure.state:{},failureSummary:status==='failed'?failure.normalized:null,hintsSaved,artifacts:changed,stdout:{sha256:sha(stdoutBlob),object:put(stdoutBlob)},stderr:{sha256:sha(stderrBlob),object:put(stderrBlob)},failureSignature:(status==='failed'||status==='checkpoint-not-reached')?failure.signature:null,repairCheckpointMatches:matchRepairs};
  // All events are append-only, objects are immutable. Do not erase earlier failures.
  i.events.push(event);atomic(indexFile,Buffer.from(JSON.stringify(i,null,2)+'\n'));
  return event;
 }
 function run({exec,argv=[],frames=120,minFrames=0,timeoutMs=120000,checkpoint='default'}={}){
  if(!Number.isInteger(frames)||frames<1||frames>500000||!Number.isInteger(minFrames)||minFrames<0||minFrames>500000||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>3600000)throw Error('Invalid run limits');
  const candidates=['game.exe','build-win/Release/game.exe','build/Release/game.exe','bin/game.exe','build/game','game'];
  let executable=exec||candidates.find(x=>fs.existsSync(path.join(root,x)));if(!executable)throw Error('Executable not found. Compile game first, then use --exec path/to/game.exe');
  executable=path.resolve(root,executable);const lst=fs.lstatSync(executable);if(!lst.isFile()||lst.isSymbolicLink())throw Error('Executable must be a regular file');
  const before=snapshot(),sourceDigest=sourceFingerprint(root),executedBinary={path:path.relative(root,executable).split(path.sep).join('/'),sha256:hashFile(executable)},start=Date.now();
  // No shell: arguments are passed verbatim to avoid interpreting user input as commands.
  const result=cp.spawnSync(executable,argv.map(String),{cwd:root,env:{...process.env,FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:String(frames),FORJA65_WATCHDOG_INSTRUCTIONS:process.env.FORJA65_WATCHDOG_INSTRUCTIONS||'50000000'},timeout:timeoutMs,maxBuffer:MAX_OUTPUT,encoding:'utf8',windowsHide:true});
  return record({before,exitCode:result.status,signal:result.signal,spawnError:result.error?.message||null,stdout:result.stdout||'',stderr:result.stderr||'',checkpoint,minFrames,command:[path.relative(root,executable),...argv],durationMs:Date.now()-start,sourceDigest,executedBinary});
 }
 function importExisting({checkpoint='historical-import'}={}){
  // Historical logs have no freshness proof, so they cannot certify a test.
  return record({before:new Map(),checkpoint,origin:'historical-import',forcedStatus:'historical-unverified'});
 }
 function report({limit=10}={}){
  const i=index(),events=i.events,counts={};for(const e of events)counts[e.status]=(counts[e.status]||0)+1;
  const unresolved=new Map();for(const e of events){if(e.status==='failed'||e.status==='checkpoint-not-reached')unresolved.set(e.checkpoint,e);else if(e.status==='checkpoint-passed'){const prior=unresolved.get(e.checkpoint);if(prior&&e.frames!==null&&e.frames>=Math.max(prior.minFrames||0,e.minFrames||0))unresolved.delete(e.checkpoint);}}
  return {schema:SCHEMA,rom:vault.id,total:events.length,counts,unresolved:[...unresolved.values()].map(e=>({id:e.id,checkpoint:e.checkpoint,status:e.status,signature:e.failureSignature})),recent:events.slice(-Math.max(0,Math.min(100,limit))).map(({id,at,status,checkpoint,frames,exitCode,artifacts,repairCheckpointMatches})=>({id,at,status,checkpoint,frames,exitCode,artifacts:artifacts.map(x=>x.path),repairCheckpointMatches}))};
 }
 return {root,vault,folder,scan:snapshot,record,run,importExisting,report,index};
}
module.exports={open,SCHEMA,sourceFingerprint,stableFailure,hashFile};
