'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),C=require('../forja65-core'),IO=require('../tools/project-io');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'rie-pipeline-')),rom=path.join(root,'test.sfc'),out=path.join(root,'port');
try{
 fs.writeFileSync(rom,C.makeSyntheticRom());const first=IO.generate({romPath:rom,out,max:512});assert.equal(first.a.romInventory.cache.status,'hit');
 const generated=JSON.parse(fs.readFileSync(path.join(out,'analysis/rom-inventory.json')));assert.equal(generated.cache.status,'hit');assert.equal(generated.metrics.physicalBytesScanned,0);
 const names=['src/dispatch.cpp','src/generated.hpp','CMakeLists.txt','assets/cart-data.bin'];const prior=new Map(names.map(n=>[n,fs.readFileSync(path.join(out,n))]));
 const second=IO.generate({romPath:rom,out,max:512,update:true});assert.equal(second.a.romInventory.cache.status,'hit');for(const n of names)assert.deepEqual(fs.readFileSync(path.join(out,n)),prior.get(n));
 const h='target=008100 from=008000 kind=STATE e=1 m=1 x=1 rom='+first.a.romFingerprint;const third=IO.generate({romPath:rom,out,max:512,update:true,hints:h});assert(third.a.runtimeHintsImported>0);assert.equal(third.a.romInventory.cache.status,'hit');
 const cacheDirectory=path.join(out,'analysis/rie-scan-cache');fs.rmSync(cacheDirectory,{recursive:true,force:true});fs.writeFileSync(cacheDirectory,'block cache directory');const withoutCache=IO.generate({romPath:rom,out,max:512,update:true});assert.equal(withoutCache.a.romInventory.cache.persistence,'write-error','optional disk cache failure must preserve game generation');
 const longRom=path.join(root,'long.sfc'),longOut=path.join(root,'long-port'),longData=C.makeSyntheticRom();longData.fill(0xea,0,128);longData[128]=0xdb;fs.writeFileSync(longRom,longData);
 IO.generate({romPath:longRom,out:longOut,max:256});const retained=IO.generate({romPath:longRom,out:longOut,max:1,update:true});const finalInventory=JSON.parse(fs.readFileSync(path.join(longOut,'analysis/rom-inventory.json')));assert.equal(retained.a.romInventory.metrics.identifiedCodeBytes,finalInventory.metrics.identifiedCodeBytes,'returned inventory must reflect retained CFG routines');
 const dir=path.join(root,'cli');for(let n=0;n<2;n++){const q=cp.spawnSync(process.execPath,[path.join(__dirname,'../tools/rom-inventory.js'),'--rom',rom,'--out',dir,'--max','512'],{encoding:'utf8'});assert.equal(q.status,0,q.stderr);assert.equal(JSON.parse(q.stdout).cache,n?'hit':'miss');}
 // The HTML keeps the existing generation path and passes browser storage into it.
 const html=fs.readFileSync(path.join(__dirname,'../Forja65-Portable.html'),'utf8');assert(html.includes('C.analyze(rom,65536,runtimeHintsText,rieCacheOptions())'));assert(html.includes('C.generateProject(rom,analysis,{profile,trace,...rieCacheOptions()})'));
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log('ROM_INVENTORY_PIPELINE_V043694_PASS');
