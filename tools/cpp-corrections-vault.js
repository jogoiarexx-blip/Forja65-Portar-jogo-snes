'use strict';
// Content-addressed C++ repair memory. Every replay is conditional on the exact
// pre-fix file bytes. No speculative patching across incompatible generators.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const C=require('../forja65-core');
const Vault=require('./knowledge-vault');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const SCHEMA='forja65.cpp-repairs.v1';
const MAX_SOURCE=2*1024*1024,MAX_EVIDENCE=4*1024*1024;
const allow=name=>/^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:c|cc|cpp|h|hpp)$/.test(name)&&!name.includes('..');
function atomicWrite(f,data){fs.mkdirSync(path.dirname(f),{recursive:true});const tmp=f+'.'+process.pid+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';try{fs.writeFileSync(tmp,data,{flag:'wx'});fs.renameSync(tmp,f);}finally{try{fs.unlinkSync(tmp);}catch(_){}}}
function checkRoot(root){const resolved=fs.realpathSync(root);if(!fs.statSync(resolved).isDirectory())throw Error('Project root must be a folder');return resolved;}
function readSource(root,rel){if(!allow(rel))throw Error('Invalid source path: '+rel);const filename=path.join(root,...rel.split('/'));if(!fs.existsSync(filename))return null;const stat=fs.lstatSync(filename);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_SOURCE)throw Error('Invalid, symlink or oversized source: '+rel);return fs.readFileSync(filename);}
function listSource(root,dir='src',acc=[]){const folder=path.join(root,dir);if(!fs.existsSync(folder))return acc;for(const e of fs.readdirSync(folder,{withFileTypes:true})){if(e.isSymbolicLink())continue;const p=(dir+'/'+e.name).replaceAll('\\','/');if(e.isDirectory()){if(acc.length<2000)listSource(root,p,acc);}else if(e.isFile()&&allow(p)){acc.push(p);if(acc.length>2000)throw Error('Too many C++ source files');}}return acc;}
function romFor(project){const f=path.join(project,'assets','cart-data.bin');if(!fs.existsSync(f))throw Error('Missing assets/cart-data.bin');const bytes=fs.readFileSync(f);const rom=C.loadRom(new Uint8Array(bytes),'cart-data.bin');return {rom,bytes};}
function open(project,{home}={}){const root=checkRoot(project),{rom,bytes}=romFor(root),vault=Vault.instance(rom,bytes,{home});const folder=path.join(vault.folder,'cpp-repairs'),indexFile=path.join(folder,'index.json');
 function index(){if(!fs.existsSync(indexFile))return {schema:SCHEMA,rom:vault.id,revisions:[]};const i=JSON.parse(fs.readFileSync(indexFile,'utf8'));if(i.schema!==SCHEMA||i.rom.sha256!==vault.id.sha256||i.rom.fnv1a64!==vault.id.fnv1a64||!Array.isArray(i.revisions))throw Error('C++ corrections vault identity mismatch');return i;}
 function put(blob){const digest=sha(blob),f=path.join(folder,'objects',digest+'.gz');if(!fs.existsSync(f))atomicWrite(f,zlib.gzipSync(blob));return digest;}
 function get(digest){if(!/^[a-f0-9]{64}$/.test(digest))throw Error('Invalid repair object');const b=zlib.gunzipSync(fs.readFileSync(path.join(folder,'objects',digest+'.gz')),{maxOutputLength:MAX_SOURCE});if(sha(b)!==digest)throw Error('Repair object hash mismatch');return b;}
 function capture({baseline,evidence,verified=false,notes=''}){
  if(!verified)throw Error('Explicit --verified confirmation required after checking tests.');
  const base=checkRoot(baseline),baseRom=romFor(base);if(Vault.identity(baseRom.rom,baseRom.bytes).sha256!==vault.id.sha256)throw Error('Baseline belongs to another ROM');
  if(!evidence)throw Error('Provide a test evidence log with --evidence.');
  const evidenceReal=fs.realpathSync(evidence),evidenceStat=fs.statSync(evidenceReal);
  if(!evidenceStat.isFile()||!evidenceStat.size||evidenceStat.size>MAX_EVIDENCE)throw Error('Invalid test log (empty or oversized)');
  const evidenceBytes=fs.readFileSync(evidenceReal),evidenceHash=sha(evidenceBytes),changes=[];
  for(const rel of listSource(root)){
   const updated=readSource(root,rel),original=readSource(base,rel);
   if(updated.equals(original||Buffer.alloc(0)))continue;
   changes.push({path:rel,baseSha256:original?sha(original):null,fixedSha256:put(updated),size:updated.length});
   if(changes.length>120)throw Error('More than 120 changed C++ files: capture in smaller sets');
  }
  if(!changes.length)throw Error('No changed C++ source files relative to baseline');
  const i=index(),content={schema:SCHEMA,rom:vault.id,changes,evidence:{file:path.basename(evidenceReal),sha256:evidenceHash,object:put(evidenceBytes)},declaredVerified:true,validation:'user-supplied evidence, not automatically reproduced',notes:String(notes).slice(0,500),origin:path.basename(root)};
  const digest=put(Buffer.from(JSON.stringify(content)));
  if(i.revisions.some(r=>r.object===digest))return {folder,revision:i.revisions.find(r=>r.object===digest).number,unchanged:true,files:changes.map(c=>c.path)};
  const revision=(i.revisions.at(-1)?.number||0)+1;
  i.revisions.push({number:revision,object:digest,at:new Date().toISOString(),files:changes.map(c=>c.path),evidenceSha256:evidenceHash});
  atomicWrite(indexFile,Buffer.from(JSON.stringify(i,null,2)+'\n'));
  return {folder,revision,unchanged:false,files:changes.map(c=>c.path)};
 }
 function plans(){const i=index(),map=new Map();for(const r of i.revisions){const value=JSON.parse(get(r.object).toString('utf8'));if(value.schema!==SCHEMA||value.rom.sha256!==vault.id.sha256||!value.declaredVerified)continue;for(const c of value.changes)if(allow(c.path))map.set(c.path,{...c,revision:r.number});}return {revisions:i.revisions.length,repairs:[...map.values()]};}
 function replay({target=root,apply=false}={}){
  const dst=checkRoot(target),other=romFor(dst);if(Vault.identity(other.rom,other.bytes).sha256!==vault.id.sha256)throw Error('Target project belongs to another ROM');
  const {repairs,revisions}=plans(),results=[];
  for(const r of repairs){
   const old=readSource(dst,r.path),current=old?sha(old):null;
   if(current===r.fixedSha256){results.push({file:r.path,status:'already-applied',revision:r.revision});continue;}
   if(current!==r.baseSha256){results.push({file:r.path,status:'conflict',revision:r.revision,reason:'base-hash-mismatch'});continue;}
   const fixed=get(r.fixedSha256);
   if(apply){const filename=path.join(dst,...r.path.split('/'));fs.mkdirSync(path.dirname(filename),{recursive:true});atomicWrite(filename,fixed);}
   results.push({file:r.path,status:apply?'applied':'ready',revision:r.revision});
  }
  return {revisions,results,applied:results.filter(x=>x.status==='applied').length,conflicts:results.filter(x=>x.status==='conflict').length};
 }
 return {root,vault,capture,plans,replay};
}
module.exports={open,SCHEMA,allow};
