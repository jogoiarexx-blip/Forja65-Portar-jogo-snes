'use strict';
// Conservative archaeological import of old native-port source versions.
// Never certifies an old fix or mutates the current port. Content-addressed,
// ROM-bound snapshots are permanent; comparisons are hypotheses, not patches.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const C=require('../forja65-core'),Vault=require('./knowledge-vault');
const SCHEMA='forja65.legacy-port-archaeology.v1';
const MAX_ZIP=512*1024*1024,MAX_ENTRIES=24000,MAX_SINGLE=8*1024*1024,MAX_ROM=12*1024*1024,MAX_SOURCES=2500,MAX_ARTIFACTS=240,MAX_TOTAL=160*1024*1024,MAX_INPUTS=150;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const rootFiles=/^(?:src\/(?:[\w.-]+\/)*[\w.-]+\.(?:cpp|cc|c|h|hpp)|analysis\/(?:cfg-coverage-cache|runtime-hints|knowledge-pack|function-analysis|native-map)\.(?:json|txt)|profiles\/game_config\.json|forja65-(?:oracle-hints|runtime-hints|unresolved-targets|unresolved-state|crash-trace|last-error|qa-status|knowledge)[\w.()-]*\.(?:json|txt|log)|(?:CMakeLists\.txt|CHANGELOG[^/]*\.md|README[^/]*\.(?:md|txt))|tests\/[\w.-]+\.(?:cpp|cc|c|h|hpp|py)|tools\/[\w.-]+\.(?:py|js)|reports\/[\w.-]*(?:qa|crash|regression|coverage|validation|replay|checkpoint)[\w.-]*\.(?:json|txt|log))$/i;
const isSource=name=>/^src\/(?:[\w.-]+\/)*[\w.-]+\.(?:cpp|cc|c|h|hpp)$/i.test(name);
const isArtifact=name=>rootFiles.test(name)&&!isSource(name);
const versionKey=name=>{const m=name.match(/v(\d+(?:\.\d+){1,5})(?=[^\d]|$)/i);return m?m[1].split('.').map(Number):[];};
function versionOrder(a,b){const x=versionKey(a),y=versionKey(b);for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return d;}return a.localeCompare(b);}
function atomic(file,contents){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+process.pid+'.'+crypto.randomBytes(5).toString('hex')+'.tmp';try{fs.writeFileSync(temp,contents,{flag:'wx'});fs.renameSync(temp,file);}finally{try{fs.rmSync(temp,{force:true});}catch(_){}}}
function readRom(blob){if(!blob||blob.length>MAX_ROM)throw Error('ROM missing/oversized');const rom=C.loadRom(new Uint8Array(blob),'cart-data.bin');return Vault.identity(rom,blob);}
// ZIP central-directory reader: no extraction, zip-slip, symlinks, or external tools.
function zipAccess(zipName){
 const stat=fs.lstatSync(zipName);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_ZIP)throw Error('Invalid or oversized ZIP');
 const buf=fs.readFileSync(zipName),tail=buf.subarray(Math.max(0,buf.length-65557));let eocd=-1;
 for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){eocd=i+buf.length-tail.length;break;}
 if(eocd<0)throw Error('ZIP central directory missing');
 const count=buf.readUInt16LE(eocd+10),centralSize=buf.readUInt32LE(eocd+12),offset=buf.readUInt32LE(eocd+16);
 if(count===0xffff||offset===0xffffffff||centralSize>12*1024*1024||count>MAX_ENTRIES||offset+centralSize>eocd)throw Error('Unsupported ZIP64 or oversized index');
 const entries=new Map();let cursor=offset;
 for(let i=0;i<count;i++){
  if(cursor+46>buf.length||buf.readUInt32LE(cursor)!==0x02014b50)throw Error('Damaged ZIP index');
  const flags=buf.readUInt16LE(cursor+8),method=buf.readUInt16LE(cursor+10),packed=buf.readUInt32LE(cursor+20),size=buf.readUInt32LE(cursor+24),fnlen=buf.readUInt16LE(cursor+28),extra=buf.readUInt16LE(cursor+30),comment=buf.readUInt16LE(cursor+32),local=buf.readUInt32LE(cursor+42),attrs=buf.readUInt32LE(cursor+38),name=buf.subarray(cursor+46,cursor+46+fnlen).toString('utf8').replaceAll('\\','/');
  cursor+=46+fnlen+extra+comment;
  if(!name||name.startsWith('/')||name.split('/').some(p=>p==='..')||name.includes('\0')||(attrs>>>16&0xf000)===0xa000)continue;
  if(!entries.has(name))entries.set(name,{name,size,packed,local,method,flags});
 }
 function read(e,limit=MAX_SINGLE){if(!e||e.size>limit||e.size===0xffffffff||e.packed>MAX_ZIP||e.flags&1||![0,8].includes(e.method))throw Error('Unsupported or oversized ZIP entry');
  const o=e.local;if(o+30>buf.length||buf.readUInt32LE(o)!==0x04034b50)throw Error('Bad ZIP local header');
  const start=o+30+buf.readUInt16LE(o+26)+buf.readUInt16LE(o+28);if(start+e.packed>buf.length)throw Error('Truncated ZIP entry');
  const raw=buf.subarray(start,start+e.packed),output=e.method===0?raw:zlib.inflateRawSync(raw,{maxOutputLength:limit});if(output.length!==e.size)throw Error('ZIP entry size mismatch');return output;
 }
 return {entries,read};
}
function directoryAccess(folder){const root=fs.realpathSync(folder);const entries=new Map();let count=0;
 function walk(rel='',depth=0){if(depth>12)return;for(const entry of fs.readdirSync(path.join(root,rel),{withFileTypes:true})){if(++count>MAX_ENTRIES)throw Error('Directory entry limit exceeded');if(entry.isSymbolicLink())continue;
  const p=(rel?rel+'/':'')+entry.name;if(entry.isDirectory())walk(p,depth+1);else if(entry.isFile()){const st=fs.statSync(path.join(root,p));entries.set(p,{name:p,size:st.size,filename:path.join(root,p)});}}}
 walk();return {entries,read(e,limit=MAX_SINGLE){if(e.size>limit)throw Error('Oversized file');return fs.readFileSync(e.filename);}};
}
function candidatePaths(folder,{deep=false}={}){const actual=path.resolve(folder),s=fs.statSync(actual);if(s.isFile())return [actual];
 const found=[];function walk(dir,depth){if(found.length>=MAX_INPUTS)throw Error('Too many project/ZIP inputs');const children=fs.readdirSync(dir,{withFileTypes:true});
  if(children.some(e=>e.name==='src'&&e.isDirectory())&&fs.existsSync(path.join(dir,'src'))){found.push(dir);return;}
  for(const e of children){if(e.isSymbolicLink())continue;const name=path.join(dir,e.name);
   if(e.isFile()&&/\.zip$/i.test(e.name))found.push(name);else if(e.isDirectory()&&depth<(deep?4:2)&&!['node_modules','build','build-win','analysis','.git','reports','tests'].includes(e.name.toLowerCase()))walk(name,depth+1);
  }
 }
 walk(actual,0);return found;
}
function scan(input,{romFallback=null,assumeSameRom=false}={}){
 const zipped=/\.zip$/i.test(input),access=zipped?zipAccess(input):directoryAccess(input);const all=[...access.entries.keys()];
 // Prefer the shortest root that actually has native C/C++ sources, not embedded build archives.
 const roots=new Set(all.filter(x=>x.endsWith('assets/cart-data.bin')).map(x=>x.slice(0,-'assets/cart-data.bin'.length)));
 for(const file of all)if(file.includes('src/')&&isSource(file.slice(file.indexOf('src/'))))roots.add(file.slice(0,file.indexOf('src/')));
 const choices=[...roots].filter(prefix=>all.some(x=>x.startsWith(prefix+'src/')&&isSource(x.slice(prefix.length)))).sort((a,b)=>a.split('/').length-b.split('/').length||a.length-b.length);
 if(!choices.length)throw Error('No native port src/ files in '+input);
 const prefix=choices[0],romEntry=access.entries.get(prefix+'assets/cart-data.bin');
 let ident,identityConfidence='rom-sha256';
 if(romEntry)ident=readRom(access.read(romEntry,MAX_ROM));
 else if(romFallback&&assumeSameRom){ident=readRom(fs.readFileSync(romFallback));identityConfidence='manual-rom-association-unverified';}
 else throw Error('ROM identity unavailable: '+input+'. Provide --rom game.sfc --assume-same-rom to label a manual, unverified association.');
 const sources={},artifacts={};let total=0,sourceCount=0,artifactCount=0;
 for(const [name,entry] of access.entries){if(!name.startsWith(prefix))continue;const rel=name.slice(prefix.length);
  if(!(isSource(rel)||isArtifact(rel))||entry.size>MAX_SINGLE)continue;
  if(isSource(rel)&&++sourceCount>MAX_SOURCES)throw Error('Too many source files');
  if(isArtifact(rel)&&++artifactCount>MAX_ARTIFACTS)continue;
  total+=entry.size;if(total>MAX_TOTAL)throw Error('Source size budget exceeded');
  const raw=access.read(entry),digest=sha(raw),item={sha256:digest,bytes:raw.length};
  if(isSource(rel))sources[rel]=item;else artifacts[rel]=item;
  item.raw=raw;
 }
 if(!Object.keys(sources).length)throw Error('No C++ source files');
 const snapshotBody={schema:SCHEMA,rom:ident,identityConfidence,sourceCount:Object.keys(sources).length,artifactCount:Object.keys(artifacts).length,sources:Object.fromEntries(Object.entries(sources).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,{sha256:v.sha256,bytes:v.bytes}])),artifacts:Object.fromEntries(Object.entries(artifacts).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,{sha256:v.sha256,bytes:v.bytes}]))};
 return {input:path.resolve(input),name:path.basename(input),rom:ident,identityConfidence,sources,artifacts,snapshotBody,digest:sha(Buffer.from(JSON.stringify(snapshotBody)))};
}
function changes(before,after){const out=[];for(const name of new Set([...Object.keys(before.sources),...Object.keys(after.sources)])){
 const b=before.sources[name],a=after.sources[name];if(b?.sha256===a?.sha256)continue;
 out.push({path:name,kind:!b?'added':!a?'removed':'modified',beforeSha256:b?.sha256||null,afterSha256:a?.sha256||null,confidence:'unverified-diff',status:'candidate-not-certified'});
 }return out.sort((x,y)=>x.path.localeCompare(y.path));}
function open(rom,{home}={}){const bytes=fs.readFileSync(rom),identity=readRom(bytes),vault=Vault.instance(C.loadRom(new Uint8Array(bytes),path.basename(rom)),bytes,{home});
 const dir=path.join(vault.folder,'legacy-ports'),indexFile=path.join(dir,'index.json');
 function index(){if(!fs.existsSync(indexFile))return {schema:SCHEMA,rom:identity,snapshots:[],comparisons:[]};const obj=JSON.parse(fs.readFileSync(indexFile,'utf8'));if(obj.schema!==SCHEMA||obj.rom.sha256!==identity.sha256||!Array.isArray(obj.snapshots)||!Array.isArray(obj.comparisons))throw Error('Legacy-port index identity mismatch');return obj;}
 function store(buffer){const digest=sha(buffer),file=path.join(dir,'objects',digest+'.gz');if(!fs.existsSync(file))atomic(file,zlib.gzipSync(buffer,{level:6}));return digest;}
 function importFrom(root,{apply=false,deep=false,assumeSameRom=false}={}){
  const inputs=candidatePaths(root,{deep}),group=[],issues=[];
  for(const input of inputs){try{const item=scan(input,{romFallback:rom,assumeSameRom});if(item.rom.sha256!==identity.sha256){issues.push({input:path.basename(input),reason:'different-rom-sha256'});continue;}group.push(item);}catch(e){issues.push({input:path.basename(input),reason:e.message.slice(0,300)});}}
  group.sort((a,b)=>versionOrder(a.name,b.name));
  // Exact content-addressed snapshots deduplicate identical packages, preserving aliases.
  const byDigest=new Map();for(const snap of group){const previous=byDigest.get(snap.digest);if(previous)previous.aliases.push(snap.name);else byDigest.set(snap.digest,{...snap,aliases:[snap.name]});}
  const distinct=[...byDigest.values()],i=index(),stored=new Set(i.snapshots.map(s=>s.id));
  const expected=[],allChanges=[];let prev=null;
  for(const snap of distinct){const diff=prev?changes(prev,snap):[];expected.push({name:snap.name,aliases:snap.aliases,identityConfidence:snap.identityConfidence,id:snap.digest.slice(0,16),sources:Object.keys(snap.sources).length,artifacts:Object.keys(snap.artifacts).length,changedSincePrior:diff.length});
   if(prev)allChanges.push({from:prev.name,to:snap.name,changedFiles:diff.length,files:diff.slice(0,300)});prev=snap;
  }
  let saved=0,newComparisons=0,updatedAliases=0;
  if(apply){
   for(const snap of distinct){if(stored.has(snap.digest)){const prior=i.snapshots.find(x=>x.id===snap.digest);if(prior){const known=new Set(prior.aliases||[prior.name]);for(const alias of snap.aliases)if(!known.has(alias)){known.add(alias);updatedAliases++;}prior.aliases=[...known].sort();}continue;}
    for(const x of Object.values({...snap.sources,...snap.artifacts}))store(x.raw);
    store(Buffer.from(JSON.stringify(snap.snapshotBody)));
    i.snapshots.push({id:snap.digest,record:snap.digest,name:snap.name,aliases:snap.aliases,identityConfidence:snap.identityConfidence,sources:Object.keys(snap.sources).length,artifacts:Object.keys(snap.artifacts).length,at:new Date().toISOString()});stored.add(snap.digest);saved++;
   }
   // Compare the entire cumulative lineage, not only the archives in this batch.
   const lineage=[...i.snapshots].sort((a,b)=>versionOrder(a.name,b.name)),oldPairs=new Set(i.comparisons.map(x=>x.from+'>'+x.to));
   for(let k=1;k<lineage.length;k++){
    const a=lineage[k-1],b=lineage[k],key=a.id+'>'+b.id;if(oldPairs.has(key))continue;
    const load=s=>{const f=path.join(dir,'objects',s.record+'.gz'),raw=zlib.gunzipSync(fs.readFileSync(f),{maxOutputLength:3*1024*1024});if(sha(raw)!==s.record)throw Error('Corrupted historical manifest');return JSON.parse(raw);};
    const aa=load(a),bb=load(b),aSources=aa.sources,bSources=bb.sources,items=[];
    for(const rel of new Set([...Object.keys(aSources),...Object.keys(bSources)]))if(aSources[rel]?.sha256!==bSources[rel]?.sha256)items.push({path:rel,kind:!aSources[rel]?'added':!bSources[rel]?'removed':'modified',beforeSha256:aSources[rel]?.sha256||null,afterSha256:bSources[rel]?.sha256||null,status:'historical-candidate-unverified'});
    i.comparisons.push({from:a.id,to:b.id,fromName:a.name,toName:b.name,changes:items.sort((x,y)=>x.path.localeCompare(y.path))});oldPairs.add(key);newComparisons++;
   }
   if(saved||newComparisons||updatedAliases)atomic(indexFile,Buffer.from(JSON.stringify(i,null,2)+'\n'));
  }
  return {schema:SCHEMA,rom:identity.sha256,mode:apply?'imported':'preview',inputs:inputs.length,compatible:group.length,distinctSnapshots:distinct.length,newSnapshots:saved,newComparisons,updatedAliases,versions:expected,comparisons:allChanges,skipped:issues,knowledgeFolder:dir,warning:'Source changes and old logs are unverified historical evidence, not certified repairs. No C++ file or CFG is applied automatically.'};
 }
 function report({limit=20}={}){const i=index(),latest=i.comparisons.slice(-Math.max(0,Math.min(100,limit)));return {schema:SCHEMA,rom:identity.sha256,storedSnapshots:i.snapshots.length,storedComparisons:i.comparisons.length,versions:i.snapshots.map(({name,aliases,identityConfidence,sources,artifacts})=>({name,aliases,identityConfidence,sources,artifacts})),recentComparisons:latest.map(x=>({from:x.fromName,to:x.toName,changedFiles:x.changes.length,files:x.changes.slice(0,40)})),policy:'historical-unverified-no-automatic-patch'};}
 function findChangesForPc(pc,{limit=8}={}){if(!Number.isInteger(pc)||pc<0||pc>0xffffff)return [];
  const hex=pc.toString(16).padStart(6,'0'),results=[];
  for(const cmp of index().comparisons)for(const c of cmp.changes){
   if(c.path.toLowerCase().match(new RegExp('(?:^|/)forja_'+hex+'\\.(?:cpp|cc|c)$'))){
    results.push({from:cmp.fromName,to:cmp.toName,path:c.path,status:'unverified-historical-source-change'});
    if(results.length>=limit)return results;
   }
  }
  return results;
 }
 return {identity,vault,index,importFrom,report,findChangesForPc};
}
module.exports={SCHEMA,open,scan,candidatePaths,versionOrder,changes};
