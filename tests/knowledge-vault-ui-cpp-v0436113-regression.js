'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const C=require('../forja65-core'),IO=require('../tools/project-io'),Repairs=require('../tools/cpp-corrections-vault'),{start}=require('../tools/gui-server');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'forja-gui-v113-')),home=path.join(root,'vault');
const rom=Buffer.from(C.makeSyntheticRom()),hash=C.romFingerprint(C.loadRom(rom,'test.sfc'));
function project(name,content){const d=path.join(root,name);fs.mkdirSync(path.join(d,'assets'),{recursive:true});fs.mkdirSync(path.join(d,'src'),{recursive:true});fs.writeFileSync(path.join(d,'assets','cart-data.bin'),rom);fs.writeFileSync(path.join(d,'src','native_hooks.cpp'),content);return d;}
function call(port,uri,{data,contentType='application/json'}={}){return new Promise((resolve,reject)=>{const b=Buffer.from(contentType==='application/json'?JSON.stringify(data||{}):data||'');const req=http.request({host:'127.0.0.1',port,path:uri,method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':contentType,'Content-Length':b.length,'Origin':`http://127.0.0.1:${port}`}},r=>{const chunks=[];r.on('data',x=>chunks.push(x));r.on('end',()=>{const bytes=Buffer.concat(chunks),response={status:r.statusCode,headers:r.headers,bytes};try{response.body=JSON.parse(bytes.toString('utf8'));}catch(_){}resolve(response);});});req.on('error',reject);req.end(data===undefined?undefined:b);});}
(async()=>{
 const baseline=project('baseline','int player_speed(){return 1;}\n'),patched=project('patched','int player_speed(){return 2;}\n'),target=project('clean-new','int player_speed(){return 1;}\n'),conflicted=project('different','int player_speed(){return 3;}\n');
 const log=path.join(root,'test-evidence.txt');fs.writeFileSync(log,'Test run: PASS - synthetic speed check\n');
 const reg=Repairs.open(patched,{home});assert.throws(()=>reg.capture({baseline,evidence:log}),/verified/);
 const saved=reg.capture({baseline,evidence:log,verified:true});assert.equal(saved.files.length,1);
 assert.equal(reg.capture({baseline,evidence:log,verified:true}).unchanged,true);
 assert.equal(Repairs.open(target,{home}).replay().results[0].status,'ready');
 assert.equal(Repairs.open(target,{home}).replay({apply:true}).applied,1);
 assert.equal(Repairs.open(target,{home}).replay({apply:true}).results[0].status,'already-applied');
 assert.equal(Repairs.open(conflicted,{home}).replay({apply:true}).conflicts,1);
 assert.equal(fs.readFileSync(path.join(conflicted,'src','native_hooks.cpp'),'utf8'),'int player_speed(){return 3;}\n');
 const different=Buffer.from(rom);different[17]^=0x03;
 const wrong=path.join(root,'wrong');fs.mkdirSync(path.join(wrong,'assets'),{recursive:true});fs.writeFileSync(path.join(wrong,'assets','cart-data.bin'),different);
 assert.throws(()=>Repairs.open(target,{home}).replay({target:wrong,apply:true}),/another ROM/);
 const app=start({home});await new Promise(r=>app.server.once('listening',r));const port=app.server.address().port;
 try{
  assert.equal((await call(port,'/api/status')).body.online,true);
  const upload=await call(port,'/api/vault/load',{data:rom,contentType:'application/octet-stream'});assert.equal(upload.status,200,JSON.stringify(upload.body));const token=upload.body.session;
  assert.equal(upload.body.knowledge.romFingerprint,hash);
  assert.equal(upload.body.knowledge.correctionFiles.length,1);
  const hint=`rom=${hash} target=008000 kind=JSR e=1 m=1 x=1 c=? observed=5`;
  const learn=await call(port,'/api/vault/learn',{data:{session:token,hints:hint}});assert.equal(learn.status,200,JSON.stringify(learn.body));
  assert.equal(learn.body.knowledge.restoredHints,1);
  // A genuine generated-baseline repair must be reapplied by the GUI exporter.
  const cleanGenerated=path.join(root,'clean-generated'),fixedGenerated=path.join(root,'fixed-generated'),romFile=path.join(root,'cartridge.sfc');fs.writeFileSync(romFile,rom);
  IO.generate({romPath:romFile,out:cleanGenerated,max:256,hints:hint,knowledgeHome:home});
  fs.cpSync(cleanGenerated,fixedGenerated,{recursive:true});
  fs.appendFileSync(path.join(fixedGenerated,'src','native_hooks.cpp'),'\n// TESTED C++ REPAIR v113\n');
  Repairs.open(fixedGenerated,{home}).capture({baseline:cleanGenerated,evidence:log,verified:true});
  const build=await call(port,'/api/project/build',{data:{session:token,hints:hint,max:256}});
  assert.equal(build.status,200,JSON.stringify(build.body));
  assert.equal(build.bytes.subarray(0,4).toString('hex'),'504b0304');
  assert.equal(Number(build.headers['x-forja-repairs-applied']),1,'GUI exporter must safely replay exact-base source repair');
  assert.equal(Number(build.headers['x-forja-repairs-conflict'])>=0,true);
  const bad=await call(port,'/api/vault/learn',{data:{session:token,hints:`rom=ffffffffffffffff target=008000 kind=JSR e=1 m=1 x=1 c=? observed=1`}});assert.equal(bad.status,400);
  const status=await call(port,'/api/vault/summary',{data:{session:token}});assert.equal(status.body.knowledge.restoredHints,1);
  const other=await call(port,'/api/vault/load',{data:different,contentType:'application/octet-stream'});assert.equal(other.body.knowledge.correctionFiles.length,0);
  const denied=await new Promise((resolve,reject)=>{const body=JSON.stringify({session:token,hints:''});const req=http.request({host:'127.0.0.1',port,path:'/api/vault/learn',method:'POST',headers:{'Origin':'https://evil.example','Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end(body);});assert.equal(denied,403);
  console.log('knowledge-vault-ui-cpp-v0436113: PASS (C++ replay/hash conflicts; ROM isolation; UI load/save/generate; rejected hints; cross-origin blocked)');
 }finally{await new Promise(r=>{app.close();r();});}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
