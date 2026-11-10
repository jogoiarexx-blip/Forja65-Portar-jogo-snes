'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const F=path.resolve(__dirname,'..');
const {start}=require(F+'/tools/gui-server'),C=require(F+'/forja65-core');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-gui-116-'));
 const handle=start({port:0,home:dir});
 try{
  if(!handle.server.listening)await new Promise(r=>handle.server.once('listening',r));
  const url='http://127.0.0.1:'+handle.server.address().port;
  const rom=Buffer.from(C.makeSyntheticRom());
  const up=await fetch(url+'/api/vault/load',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:rom});
  if(!up.ok)throw Error('load: '+up.status+' '+await up.text());
  const data=await up.json();
  const rep=await fetch(url+'/api/recovery/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:data.session})});
  if(!rep.ok)throw Error('advice: '+rep.status+' '+await rep.text());
  const advice=(await rep.json()).recoveryAdvisor;
  if(advice.openIssues!==0||advice.rom.sha256!==data.knowledge.romSha256)throw Error('wrong advice ROM/session');
  const html=await(await fetch(url+'/')).text();
  if(!html.includes('vaultRecoveryAdvice')||!html.includes('vaultRecoveryOpen'))throw Error('HTML recovery panel missing');
  const match=html.match(/<script>([\s\S]*?)<\/script>/i);
  if(match){const vm=require('node:vm');new vm.Script(match[1],{filename:'Forja65-Portable.html inline.js'});}
  console.log('PASS: local UI ROM session, read-only advice route and HTML panel');
 }finally{handle.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
