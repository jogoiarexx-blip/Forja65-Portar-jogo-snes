'use strict';
// Per-cartridge, cross-project evidence store. Saved outside a generated port and
// outside the Forja distribution, so extracting an updated ZIP cannot erase it.
// Artifacts are content-addressed and immutable. Incompatible CFGs stay archived
// as *discovery evidence*, never as translated execution or validated gameplay.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),zlib=require('node:zlib');
const C=require('../forja65-core');
const SCHEMA='forja65.knowledge-vault.v1';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const defaultHome=()=>process.env.FORJA65_KNOWLEDGE_HOME||path.join(os.homedir(),'.forja65','knowledge-v1');
const readJson=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const mustMatch=(obj,rom)=>{if(!obj||obj.rom?.sha256!==rom.sha256||obj.rom?.fnv1a64!==rom.fnv1a64||obj.schema!==SCHEMA)throw new Error('Knowledge vault ROM/manifest mismatch');};
function atomicWrite(file,buffer){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const tmp=file+'.'+process.pid+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
 try {fs.writeFileSync(tmp,buffer,{flag:'wx'});fs.renameSync(tmp,file);}finally{try{fs.unlinkSync(tmp);}catch(_){}}
}
function identity(rom,bytes){return {sha256:sha(bytes),fnv1a64:C.romFingerprint(rom)};}
function instance(rom,bytes,{home=defaultHome()}={}){
 const id=identity(rom,bytes),folder=path.join(path.resolve(home),id.sha256),manifestFile=path.join(folder,'manifest.json');
 function loadManifest(){
  if(!fs.existsSync(manifestFile))return {schema:SCHEMA,rom:id,revision:0,records:[],hints:null,knowledge:null,profile:null,cacheCandidates:[]};
  const m=readJson(manifestFile);mustMatch(m,id);
  if(!Array.isArray(m.records)||!Array.isArray(m.cacheCandidates))throw new Error('Invalid knowledge vault manifest');
  return m;
 }
 function put(obj){
  const bytes=Buffer.from(JSON.stringify(obj));
  const digest=sha(bytes),file=path.join(folder,'objects',digest+'.json.gz');
  if(!fs.existsSync(file))atomicWrite(file,zlib.gzipSync(bytes,{level:6}));
  return digest;
 }
 function get(digest){
  if(!/^[a-f0-9]{64}$/.test(digest||''))throw new Error('Invalid knowledge object ID');
  const compressed=fs.readFileSync(path.join(folder,'objects',digest+'.json.gz'));
  // Guard against expanding unexpectedly large/corrupted archives.
  if(compressed.length>64*1024*1024)throw new Error('Knowledge object exceeds size limit');
  const raw=zlib.gunzipSync(compressed,{maxOutputLength:64*1024*1024});
  if(sha(raw)!==digest)throw new Error('Knowledge object checksum failed');
  return JSON.parse(raw.toString('utf8'));
 }
 function load({isCompatible=()=>false}={}){
  const m=loadManifest(),result={manifest:m,rom:id,cache:null,oldCache:null,knowledge:null,hints:'',profile:null,errors:[]};
  const tryGet=(key,digest)=>{if(!digest)return null;try{return get(digest);}catch(e){result.errors.push(key+': '+e.message);return null;}};
  const h=tryGet('hints',m.hints);if(h&&h.rom===id.fnv1a64&&typeof h.text==='string')result.hints=h.text;
  const k=tryGet('knowledge',m.knowledge);if(k){try{result.knowledge=C.normalizeKnowledgePack(k,id.fnv1a64);}catch(e){result.errors.push('knowledge: '+e.message);}}
  const p=tryGet('profile',m.profile);if(p&&p.rom===id.fnv1a64)result.profile=p;
  // Highest-coverage compatible version wins; all older snapshots remain on disk.
  const candidates=[...m.cacheCandidates].sort((a,b)=>b.variants-a.variants||b.revision-a.revision);
  for(const c of candidates){
   if(!c||!c.object)continue;
   const compatible=isCompatible(c.version);
   if(result.cache&&compatible)continue;
   if(result.oldCache&&!compatible)continue;
   const a=tryGet('cfg',c.object);
   if(!a||a.schema!=='forja65.cfg-coverage-cache.v1'||a.rom!==id.fnv1a64||a.version!==c.version||!Array.isArray(a.functions))continue;
   if(compatible)result.cache=a;else result.oldCache=a;
   if(result.cache&&result.oldCache)break;
  }
  return result;
 }
 function save({hints='',knowledge=null,profile=null,cache=null,origin='generated'}={}){
  const m=loadManifest(),changed=[];
  // Merge observations by ROM, target, caller and CPU state; never lose an
  // earlier observation when a later run sees fewer paths.
  const oldHints=m.hints?get(m.hints):null;
  const texts=[oldHints?.text||'',hints];
  const hintsMap=new Map();
  for(const text of texts)for(const h of C.parseRuntimeHints(text)){
   if(h.rom!==id.fnv1a64)continue;
   const key=[h.rom,h.target,h.from,h.kind,h.state.emulation,h.state.m8,h.state.x8,h.state.carry].join('|');
   if(!hintsMap.has(key)||hintsMap.get(key).observed<h.observed)hintsMap.set(key,h);
  }
  const joined=C.formatRuntimeHints([...hintsMap.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,h])=>h));
  if(joined){const obj=put({rom:id.fnv1a64,text:joined});if(obj!==m.hints){m.hints=obj;changed.push('hints');}}
  if(knowledge){
   const normalized=C.normalizeKnowledgePack(knowledge,id.fnv1a64);
   const existing=m.knowledge?get(m.knowledge):null;
   // Retain the previous pack if it contains more reviewed entries. Preserve
   // both complete packs as immutable records, not a speculative union.
   const obj=put(normalized);
   if(!existing||!Array.isArray(existing.entries)||normalized.entries.length>=existing.entries.length){if(obj!==m.knowledge){m.knowledge=obj;changed.push('knowledge');}}
  }
  if(profile&&profile.rom===id.fnv1a64){const obj=put(profile);if(obj!==m.profile){m.profile=obj;changed.push('profile');}}
  if(cache){
   if(cache.schema!=='forja65.cfg-coverage-cache.v1'||cache.rom!==id.fnv1a64||!Array.isArray(cache.functions)||typeof cache.version!=='string')throw new Error('Invalid CFG evidence identity');
   const obj=put(cache);
   if(!m.cacheCandidates.some(x=>x.object===obj)){
    const variants=new Set(cache.functions.flatMap(f=>(f.instructions||[]).map(i=>[i.pc,JSON.stringify(i.stateIn)].join('|'))).values()).size;
    m.cacheCandidates.push({object:obj,version:cache.version,variants,revision:m.revision+1});changed.push('cfg');
   }
  }
  if(changed.length){
   m.revision++;
   m.records.push({revision:m.revision,at:new Date().toISOString(),origin:String(origin).slice(0,200),changed});
   // All objects are preserved indefinitely. The manifest is small and append-only.
   atomicWrite(manifestFile,Buffer.from(JSON.stringify(m,null,2)+'\n'));
  }
  return {folder,revision:m.revision,changed,rom:id};
 }
 // REV202: certificados de rota (REV200, CPU_AOT_CERTIFIED). Guardados como objetos imutaveis; o gerador usa
 // os que pertencem a esta ROM para promover o STATUS final do port. Nunca altera o CFG.
 const romDataSha=sha(Buffer.from(rom.data));
 function addCertification(cert,{label=null}={}){
  if(!C.validRouteCertification(cert))throw new Error('certificado invalido: exige schema REV200, status CPU_AOT_CERTIFIED, strict_cpu_aot_certified=true e entradas logicas > 0');
  if(String(cert.rom_sha256||'').toLowerCase()!==romDataSha)throw new Error('certificado pertence a outra ROM (rom_sha256 diferente)');
  const m=loadManifest();if(!Array.isArray(m.certifications))m.certifications=[];
  const stored={...cert,label:label||cert.label||null,imported_at:new Date().toISOString()};delete stored.profile_env;
  const obj=put(stored);
  if(!m.certifications.some(x=>x.object===obj)){
   m.certifications.push({object:obj,status:cert.status,logic_sha256:cert.logic_sha256||null,logical_inputs:cert.certified_logical_inputs,label:stored.label});
   m.revision++;m.records.push({revision:m.revision,at:stored.imported_at,origin:'route-certification',changed:['certification']});
   atomicWrite(manifestFile,Buffer.from(JSON.stringify(m,null,2)+'\n'));
  }
  return {folder,object:obj,revision:m.revision};
 }
 function certifications(){
  const m=loadManifest(),out=[];
  for(const c of (Array.isArray(m.certifications)?m.certifications:[])){try{const x=get(c.object);if(C.validRouteCertification(x)&&String(x.rom_sha256||'').toLowerCase()===romDataSha)out.push(x);}catch(_){}}
  return out;
 }
 return {id,folder,load,save,addCertification,certifications};
}
function seedsFromLegacyCache(cache,{limit=512}={}){
 if(!cache||!Array.isArray(cache.functions))return [];
 const seen=new Set(),seeds=[];
 for(const f of cache.functions){
  if(!Number.isInteger(f.start)||f.start<0||f.start>0xffffff||!f.entryState)continue;
  const st=f.entryState;
  if(typeof st.emulation!=='boolean'||typeof st.m8!=='boolean'||typeof st.x8!=='boolean'||(st.carry!==null&&typeof st.carry!=='boolean'))continue;
  const key=f.start+':'+JSON.stringify(st);if(seen.has(key))continue;
  seen.add(key);seeds.push({start:f.start,state:{...st},entryName:'VAULT-RECHECK'});
  if(seeds.length>=limit)break;
 }
 return seeds;
}
module.exports={SCHEMA,identity,instance,seedsFromLegacyCache,defaultHome};
