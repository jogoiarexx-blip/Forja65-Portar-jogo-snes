'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {start}=require('../tools/gui-server'),C=require('../forja65-core');
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-gui-legacy-117-'));
 const rom=Buffer.from(C.makeSyntheticRom()),zip=path.join(temp,'OldPort-v0.1.0.zip');
 fs.writeFileSync(zip,Buffer.from(C.buildZip({'OldPort-v0.1.0/assets/cart-data.bin':rom,'OldPort-v0.1.0/src/hooks.cpp':'historical code'})));
 const instance=start({port:0,home:path.join(temp,'vault')});
 try{
  if(!instance.server.listening)await new Promise(ok=>instance.server.once('listening',ok));
  const url='http://127.0.0.1:'+instance.server.address().port;
  const romResponse=await fetch(url+'/api/vault/load',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:rom});assert.ok(romResponse.ok);
  const loaded=await romResponse.json();assert.equal(loaded.knowledge.legacyPortHistory.storedSnapshots,0);
  const send=async apply=>{
   const r=await fetch(url+'/api/legacy/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:loaded.session,source:zip,apply})});if(!r.ok)throw Error(await r.text());return r.json();
  };
  const preview=await send(false);assert.equal(preview.imported.newSnapshots,0);
  const imported=await send(true);assert.equal(imported.imported.newSnapshots,1);assert.equal(imported.knowledge.legacyPortHistory.storedSnapshots,1);
  assert.ok((await(await fetch(url+'/')).text()).includes('vaultLegacy'));
  console.log('PASS GUI legacy preview/import/ROM dashboard');
 }finally{instance.close();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
