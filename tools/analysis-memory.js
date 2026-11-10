'use strict';
// Exact-input memoization around the existing analyzer; no new decoder or CFG.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),v8=require('node:v8');
const SCHEMA='forja65.analysis-memory.v1',MAX_BYTES=16*1024*1024,MAX_ENTRIES=2;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
// Type tags prevent Map/Set/null/undefined and reordered object keys aliasing.
// Array and Map/Set iteration order is significant to the existing queue.
function canonical(value,seen=new Set()){
 if(value===undefined)return ['undefined'];
 if(value===null||typeof value==='string'||typeof value==='boolean')return [typeof value,value];
 if(typeof value==='number'&&Number.isFinite(value))return ['number',Object.is(value,-0)?'-0':value];
 if(typeof value!=='object'||seen.has(value))throw new Error('Unkeyable analysis input');
 seen.add(value);let out;
 if(Array.isArray(value))out=['array',Array.from(value,x=>canonical(x,seen))];
 else if(value instanceof Map)out=['map',[...value].map(([k,v])=>[canonical(k,seen),canonical(v,seen)])];
 else if(value instanceof Set)out=['set',[...value].map(x=>canonical(x,seen))];
 else if(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)out=['object',Object.keys(value).sort().map(k=>[k,canonical(value[k],seen)])];
 else throw new Error('Unkeyable analysis object');
 seen.delete(value);return out;
}
function sourceIdentity(directory){
 // Core contains bundled decoder, knowledge catalogs and all analysis modules.
 const files=['forja65-core.js','tools/project-io.js','tools/analysis-memory.js','tools/rie-cache.js'];
 return digest(JSON.stringify(files.map(n=>[n,digest(fs.readFileSync(path.join(directory,n)))]))+'|'+process.versions.node+'|'+process.versions.v8);
}
function createAnalysisMemory(directory,{identity,enabled=true,maxBytes=MAX_BYTES}={}){
 maxBytes=Math.max(0,Math.min(MAX_BYTES,Number(maxBytes)||0));
 const folder=path.join(directory,'snapshots'),pending=new Map();
 const stats={schema:SCHEMA,enabled:!!enabled,lookups:0,hits:0,misses:0,invalid:0,bypassed:0,readBytes:0,queuedBytes:0,maxEntries:MAX_ENTRIES,maxSnapshotBytes:maxBytes};
 const keyFor=request=>digest(JSON.stringify(canonical({schema:SCHEMA,identity,request})));
 function decode(bytes,key){
  if(bytes.length>maxBytes+1024)throw new Error('Snapshot too large');
  const end=bytes.indexOf(10);if(end<0||end>1024)throw new Error('Invalid header');
  const header=JSON.parse(bytes.subarray(0,end).toString('utf8')),payload=bytes.subarray(end+1);
  if(header.schema!==SCHEMA||header.key!==key||header.size!==payload.length||payload.length>maxBytes||header.sha256!==digest(payload))throw new Error('Snapshot integrity mismatch');
  return v8.deserialize(payload);
 }
 return {stats,
  run(request,compute){
   if(!enabled){stats.bypassed++;return compute();}
   let key;try{key=keyFor(request);}catch(_){stats.bypassed++;return compute();}stats.lookups++;
   const file=path.join(folder,key+'.bin');
   try{
    let bytes=pending.get(key);
    if(!bytes&&fs.existsSync(file)){if(fs.statSync(file).size>maxBytes+1024)throw new Error('Snapshot too large');bytes=fs.readFileSync(file);}
    if(bytes){const result=decode(bytes,key);stats.hits++;stats.readBytes+=bytes.length;return result;}
   }catch(_){stats.invalid++;}
   stats.misses++;const result=compute();
   try{
    const payload=v8.serialize(result);
    if(payload.length>maxBytes){stats.bypassed++;return result;}
    const header=JSON.stringify({schema:SCHEMA,key,sha256:digest(payload),size:payload.length})+'\n';
    pending.delete(key);pending.set(key,Buffer.concat([Buffer.from(header),payload]));
    while(pending.size>MAX_ENTRIES)pending.delete(pending.keys().next().value);
    stats.queuedBytes=[...pending.values()].reduce((n,b)=>n+b.length,0);
   }catch(_){stats.bypassed++;}return result;
  },
  commit(){
   let saved=0,failed=0,recovered=0;
   // A hard process exit skips finally. Recover only our exact temp names
   // whose owning process is provably absent; EPERM/unknown means keep it.
   try{if(fs.existsSync(folder))for(const name of fs.readdirSync(folder)){
    const match=/^[a-f0-9]{64}\.bin\.([1-9][0-9]*)\.[a-f0-9]{12}\.tmp$/.exec(name);
    if(!match)continue;const pid=Number(match[1]);if(!Number.isSafeInteger(pid)||pid>2147483647)continue;
    let absent=false;try{process.kill(pid,0);}catch(error){absent=error.code==='ESRCH';}
    if(absent){fs.unlinkSync(path.join(folder,name));recovered++;}
   }}catch(_){failed++;}
   for(const [key,bytes]of pending){
    const file=path.join(folder,key+'.bin'),tmp=file+'.'+process.pid+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
    try{fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(tmp,bytes);fs.renameSync(tmp,file);saved++;}
    catch(_){failed++;}finally{try{fs.unlinkSync(tmp);}catch(_){}}
   }
   pending.clear();stats.queuedBytes=0;
   // Prune only this module's named snapshots, never neighboring analysis files.
   try{if(saved){const files=fs.readdirSync(folder).filter(n=>/^[a-f0-9]{64}\.bin$/.test(n)).map(n=>({n,time:fs.statSync(path.join(folder,n)).mtimeMs})).sort((a,b)=>b.time-a.time||a.n.localeCompare(b.n));for(const f of files.slice(MAX_ENTRIES))fs.unlinkSync(path.join(folder,f.n));}}catch(_){failed++;}
   return {saved,failed,recovered};
  }
 };
}
module.exports={SCHEMA,canonical,sourceIdentity,createAnalysisMemory};

// This index points at the authoritative existing reports instead of copying
// every instruction/table/region into a second, potentially divergent database.
function knowledgeReport(a,previous,old,identity,memo){
 const all=new Set(a.functions.flatMap(f=>f.instructions.map(i=>i.pc))),before=new Set((previous?.functions||[]).flatMap(f=>f.instructions.map(i=>i.pc)));
 const added=[...all].filter(pc=>!before.has(pc)).sort((a,b)=>a-b),inv=a.romInventory;
 const compatible=old?.schema==='forja65.persistent-analysis.v1'&&old.identity?.romSha256===identity.romSha256;
 const history=compatible&&Array.isArray(old.history)?old.history.slice(-31).filter(h=>h&&Number.isSafeInteger(h.revision)&&h.revision>=1&&Number.isSafeInteger(h.newAddressCount)&&Array.isArray(h.newAddresses)).map(h=>({revision:h.revision,newAddressCount:h.newAddressCount,newAddresses:h.newAddresses.filter(Number.isInteger).slice(0,256),truncated:Math.max(0,h.newAddressCount-256),decoded:h.decoded,functionVariants:h.functionVariants,source:typeof h.source==='string'?h.source.slice(0,64):null})):[];
 const revision=history.length?Math.min(Number.MAX_SAFE_INTEGER,history[history.length-1].revision+1):1;
 history.push({revision,newAddressCount:added.length,newAddresses:added.slice(0,256),truncated:Math.max(0,added.length-256),decoded:all.size,functionVariants:a.functions.length,source:identity.source});
 return {schema:'forja65.persistent-analysis.v1',identity,analyzer:a.version,memo:{...memo},history,
  coverage:{inventoriedBytes:inv?.metrics.inventoriedBytes||0,identifiedCodeBytes:inv?.metrics.identifiedCodeBytes||0,translatableBytes:inv?.metrics.translatableBytes||0,executionValidatedBytes:0,compiledValidatedBytes:0,decodedAddresses:all.size,functionVariants:a.functions.length,pendingFunctions:a.cfgFrontier?.length||0},
  banks:{ids:(inv?.banks||[]).map(b=>b.bank),scope:inv?.mapping.scope||'unavailable',mappingComplete:inv?.mapping.complete===true},
  records:{functionsAndCpuStates:'analysis/cfg-coverage-cache.json#functions',pendingPaths:'analysis/cfg-coverage-cache.json#cfgFrontier',pendingInternalPaths:'analysis/cfg-coverage-cache.json#functions/internalFrontier',staticAndDynamicEvidence:'analysis/cfg-coverage-cache.json#functions',indirectTargetsAndTables:'analysis/indirect-targets.json',regionsAndUnknownBytes:'analysis/rom-inventory.json#regions',dynamicObservations:'analysis/runtime-hints.txt'},
  limits:{history:32,newAddressesPerRevision:256},
  notes:['Memoized results are valid only for exact ROM/source/options/queue inputs. New frontiers require fresh analysis.', 'Checksums detect accidental cache corruption; they are not a security signature.', 'History is informational and never seeds execution or claims gameplay validation.', 'Translatable bytes indicate emitter support, not successful compilation or execution.']};
}
module.exports.knowledgeReport=knowledgeReport;
