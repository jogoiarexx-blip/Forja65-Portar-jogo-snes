#!/usr/bin/env node
'use strict';
// Local-only HTTP bridge for Forja65's existing HTML interface. The browser
// never gets arbitrary filesystem access; the Node generator owns persistence.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),crypto=require('node:crypto');
const C=require('../forja65-core'),Vault=require('./knowledge-vault'),IO=require('./project-io'),Repairs=require('./cpp-corrections-vault'),Runtime=require('./runtime-evidence-vault'),Regression=require('./regression-intelligence'),Recovery=require('./recovery-advisor'),Legacy=require('./legacy-port-archaeology');
const ROOT=path.resolve(__dirname,'..'),MAX_ROM=12*1024*1024,MAX_JSON=2*1024*1024;
const error=(code,msg)=>Object.assign(new Error(msg),{httpCode:code});
function start({port=0,host='127.0.0.1',home,openBrowser=false}={}){
 if(host!=='127.0.0.1')throw Error('Forja local server must only bind to loopback');
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-ui-')),sessions=new Map();let active=true;
 function session(id){if(!/^[0-9a-f]{32}$/.test(id||'')||!sessions.has(id))throw error(404,'No ROM session. Load the cartridge again.');return sessions.get(id);}
 function send(res,status,value,headers={}){const binary=Buffer.isBuffer(value);const buf=binary?value:Buffer.from(JSON.stringify(value));res.writeHead(status,{'Content-Type':binary?'application/octet-stream':'application/json; charset=utf-8','Content-Length':buf.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(buf);}
 function read(req,limit){return new Promise((resolve,reject)=>{let n=0,parts=[];req.on('data',chunk=>{n+=chunk.length;if(n>limit){reject(error(413,'Request size limit exceeded'));req.destroy();return;}parts.push(chunk);});req.on('end',()=>resolve(Buffer.concat(parts)));req.on('error',reject);});}
 async function body(req,limit=MAX_JSON){let data=await read(req,limit);try{return JSON.parse(data.toString('utf8'));}catch(_){throw error(400,'Invalid JSON request');}}
 function overview(s){const v=Vault.instance(s.rom,s.bytes,{home}),prior=v.load({isCompatible:IO.isAuditedCacheVersion}),repair=Repairs.open(s.project,{home}).plans();return {schema:'forja65.ui-knowledge.v1',romSha256:v.id.sha256,romDataSha256:require('node:crypto').createHash('sha256').update(Buffer.from(s.rom.data)).digest('hex'),routeCertifications:(()=>{try{return v.certifications();}catch(_){return [];}})(),romFingerprint:v.id.fnv1a64,revision:prior.manifest.revision,restoredHints:C.parseRuntimeHints(prior.hints).length,compatibleCfg:prior.cache?.functions?.length||0,archivedCfg:prior.manifest.cacheCandidates.length,knowledgeEntries:prior.knowledge?.entries?.length||0,runtimeEvidence:Runtime.open(s.project,{home}).report({limit:5}),regressionEvidence:Regression.open(s.project,{home}).check({inspectSource:false}),recoveryAdvisor:Recovery.open(s.project,{home}).report({limit:5,inspectSource:false}),legacyPortHistory:Legacy.open(s.romFile,{home}).report({limit:8}),correctionRevisions:repair.revisions,correctionFiles:repair.repairs.map(x=>x.path),errors:prior.errors,hints:prior.hints,knowledge:prior.knowledge,profile:prior.profile};}
 const server=http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://localhost');
   if(req.method==='GET' && (u.pathname==='/'||u.pathname==='/Forja65-Portable.html'||u.pathname==='/forja65-core.js')){
    const f=path.join(ROOT,u.pathname==='/forja65-core.js'?'forja65-core.js':'Forja65-Portable.html');const b=fs.readFileSync(f);res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':b.length,'X-Content-Type-Options':'nosniff'});return res.end(b);
   }
   if(req.method==='GET'&&u.pathname==='/api/status')return send(res,200,{online:true,version:C.VERSION,vaultHome:Vault.defaultHome(),mode:'local-node-bridge'});
   if(req.method!=='POST'||!u.pathname.startsWith('/api/'))throw error(404,'Not found');
   // Block cross-site requests; no CORS or arbitrary CORS preflight allowed.
   const origin=req.headers.origin;
   if(origin&&origin!==`http://127.0.0.1:${server.address().port}`)throw error(403,'Cross-origin request blocked');
   if(u.pathname==='/api/vault/load'){
    if(req.headers['content-type']!=='application/octet-stream')throw error(415,'Upload ROM as application/octet-stream');
    const bytes=await read(req,MAX_ROM),rom=C.loadRom(new Uint8Array(bytes),'cartridge.sfc'),id=crypto.randomBytes(16).toString('hex');
    if(sessions.size>2){const old=sessions.keys().next().value;sessions.delete(old);fs.rmSync(path.join(work,old),{recursive:true,force:true});try{fs.unlinkSync(path.join(work,old+'.sfc'));}catch(_){}}
    const project=path.join(work,id),assets=path.join(project,'assets');fs.mkdirSync(assets,{recursive:true});fs.writeFileSync(path.join(assets,'cart-data.bin'),bytes);
    const romFile=path.join(work,id+'.sfc');fs.writeFileSync(romFile,bytes);const s={rom,bytes,project,romFile,id};sessions.set(id,s);
    return send(res,200,{session:id,knowledge:overview(s)});
   }
   const request=await body(req),s=session(request.session),vault=Vault.instance(s.rom,s.bytes,{home});
   if(u.pathname==='/api/vault/summary')return send(res,200,{knowledge:overview(s)});
   if(u.pathname==='/api/recovery/report')return send(res,200,{recoveryAdvisor:Recovery.open(s.project,{home}).report({limit:10,inspectSource:false})});
   if(u.pathname==='/api/vault/learn'){
    const hints=typeof request.hints==='string'?request.hints:'';
    // Explicitly bind untagged observations to the currently loaded ROM; other ROM hints are refused.
    const decoded=C.parseRuntimeHintsDetailed(hints);if(decoded.rejected?.length)throw error(400,'Malformed runtime hints');
    if(decoded.hints.some(h=>h.rom&&h.rom!==vault.id.fnv1a64))throw error(400,'Hints belong to another ROM');
    const profile=request.profile?C.normalizeProfile(request.profile,vault.id.fnv1a64):null;
    const knowledge=request.knowledge?C.normalizeKnowledgePack(request.knowledge,vault.id.fnv1a64):null;
    const report=vault.save({hints,profile,knowledge,origin:'Forja65-Windows-UI'});
    return send(res,200,{saved:{revision:report.revision,changed:report.changed},knowledge:overview(s)});
   }
   if(u.pathname==='/api/project/build'){
    const hints=typeof request.hints==='string'?request.hints:'';
    const max=request.max===undefined?262144:Number(request.max);if(!Number.isInteger(max)||max<1||max>1048576)throw error(400,'Invalid decode budget');
    const target=path.join(work,'port-'+crypto.randomBytes(10).toString('hex'));
    try{
     const result=IO.generate({romPath:s.romFile,out:target,max,hints,profile:request.profile||undefined,knowledge:request.knowledge||undefined,trace:request.trace||null,knowledgeHome:home});
     const memory=Repairs.open(target,{home});const repairs=memory.replay({apply:true});
     if(repairs.applied){const changed={};for(const r of repairs.results)if(r.status==='applied')changed[r.file]=fs.readFileSync(path.join(target,...r.file.split('/')));IO.refreshManifest(target,changed);}
     fs.writeFileSync(path.join(target,'analysis','cpp-repairs-restore.json'),JSON.stringify(repairs,null,2)+'\n');
     const files={};function pack(directory='',level=0){if(level>15)throw Error('Project nesting exceeds ZIP limit');for(const x of fs.readdirSync(path.join(target,directory),{withFileTypes:true})){if(x.isSymbolicLink())continue;const rel=path.join(directory,x.name),normalized=rel.split(path.sep).join('/');if(x.isDirectory())pack(rel,level+1);else if(x.isFile()){if(x.name.endsWith('.tmp'))continue;files[normalized]=fs.readFileSync(path.join(target,rel));}}}pack();
     const zip=Buffer.from(C.buildZip(files));return send(res,200,zip,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="Forja65-Port-Cpp-Com-Memoria.zip"','X-Forja-Repairs-Conflict':String(repairs.conflicts),'X-Forja-Repairs-Applied':String(repairs.applied),'X-Forja-Vault-Revision':String(result.vault?.saved?.revision||0)});
    }finally{fs.rmSync(target,{recursive:true,force:true});}
   }
   if(u.pathname==='/api/legacy/import'){
    if(typeof request.source!=='string'||!request.source.trim()||request.source.length>1200)throw error(400,'Informe pasta ou ZIP de ports antigos');
    const source=path.resolve(request.source.trim());if(!fs.existsSync(source))throw error(404,'Pasta ou ZIP não encontrado');
    // Controlled local-only request; never edits the supplied old ports.
    const imported=Legacy.open(s.romFile,{home}).importFrom(source,{apply:request.apply===true,assumeSameRom:request.assumeSameRom===true});
    return send(res,200,{imported,knowledge:overview(s)});
   }
   if(u.pathname==='/api/corrections/capture'){
    const source=path.resolve(String(request.project||'')),base=path.resolve(String(request.baseline||'')),evidence=path.resolve(String(request.evidence||''));
    const repairs=Repairs.open(source,{home});if(repairs.vault.id.sha256!==vault.id.sha256)throw error(400,'Wrong project ROM');
    return send(res,200,{captured:repairs.capture({baseline:base,evidence,verified:request.verified===true,notes:request.notes||''}),knowledge:overview(s)});
   }
   if(u.pathname==='/api/corrections/replay'){
    const target=path.resolve(String(request.project||'')),repairs=Repairs.open(target,{home});if(repairs.vault.id.sha256!==vault.id.sha256)throw error(400,'Wrong target ROM');
    const out=repairs.replay({apply:request.apply===true});
    if(out.applied){const changed={};for(const r of out.results)if(r.status==='applied')changed[r.file]=fs.readFileSync(path.join(target,...r.file.split('/')));if(fs.existsSync(path.join(target,'forja65-build-manifest.txt')))IO.refreshManifest(target,changed);}
    return send(res,200,{restored:out,knowledge:overview(s)});
   }
   throw error(404,'API route not found');
  }catch(e){if(!res.writableEnded&&!res.destroyed)send(res,e.httpCode||500,{error:e.message});}
 });
 function close(){if(!active)return;active=false;server.close();fs.rmSync(work,{recursive:true,force:true});}
 server.on('close',()=>{if(active){active=false;fs.rmSync(work,{recursive:true,force:true});}});
 server.listen(port,host,()=>{const url=`http://${host}:${server.address().port}/`;if(openBrowser){const edgeCandidates=[path.join(process.env['ProgramFiles(x86)']||'','Microsoft/Edge/Application/msedge.exe'),path.join(process.env.ProgramFiles||'','Microsoft/Edge/Application/msedge.exe'),path.join(process.env.LOCALAPPDATA||'','Microsoft/Edge/Application/msedge.exe')];const edge=edgeCandidates.find(x=>fs.existsSync(x));if(process.platform==='win32'){const browser=edge?cp.spawn(edge,['--app='+url,'--start-maximized','--no-first-run'],{detached:true,stdio:'ignore'}):cp.spawn('cmd.exe',['/c','start','',url],{detached:true,stdio:'ignore'});browser.unref();}console.log('Forja65 local GUI: '+url);}else console.log('Forja65 local GUI: '+url);});
 return {server,close,work};
}
if(require.main===module){start({port:Number(process.env.FORJA65_UI_PORT||0),openBrowser:process.argv.includes('--open')});}
module.exports={start};
