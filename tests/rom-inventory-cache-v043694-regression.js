'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),C=require('../forja65-core');
const data=C.makeSyntheticRom(),rom=C.loadRom(data),memory=new Map(),cache={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const a=C.inventoryRom(rom,null,{cache});assert.equal(a.cache.status,'miss');assert.equal(a.metrics.physicalBytesScanned,rom.data.length);
const b=C.inventoryRom(rom,null,{cache});assert.equal(b.cache.status,'hit');assert.equal(b.metrics.physicalBytesScanned,0);assert.equal(b.metrics.pagesReused,Math.ceil(rom.data.length/256));assert.deepEqual(b.regions,a.regions);
// Code discovered after the static scan must appear even when the scan is reused.
const analysis=C.analyze(rom,512,[],{inventoryCache:cache});assert.equal(analysis.romInventory.cache.status,'hit');assert(analysis.romInventory.metrics.identifiedCodeBytes>0);
const changed=C.loadRom(data.slice());changed.data[0x1234]^=1;assert.equal(C.inventoryRom(changed,null,{cache}).cache.status,'miss');
const broken={getItem:()=>'{"bad":true}',setItem:()=>{}};assert.equal(C.inventoryRom(rom,null,{cache:broken}).cache.status,'miss');
const unavailable={getItem:()=>{throw new Error('permission denied');},setItem:()=>{throw new Error('disk full');}};assert.equal(C.inventoryRom(rom,null,{cache:unavailable}).metrics.physicalBytesScanned,rom.data.length);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rie-cache-test-'));
try{const makeCache=require('../tools/rie-cache').createInventoryCache;
 const disk=makeCache(dir),first=C.inventoryRom(rom,null,{cache:disk});assert.equal(first.cache.status,'miss');assert.equal(C.inventoryRom(rom,null,{cache:makeCache(dir)}).cache.status,'hit');
 const file=fs.readdirSync(dir).find(f=>f.endsWith('.json'));const text=fs.readFileSync(path.join(dir,file),'utf8');fs.writeFileSync(path.join(dir,file),text.replace('uniform', 'corrupt'));
 // If the text did not contain the field, a deliberately truncated file still tests recovery.
 fs.writeFileSync(path.join(dir,file),'{bad');assert.equal(C.inventoryRom(rom,null,{cache:makeCache(dir)}).cache.status,'miss');
 const exported=C.generateProject(rom,analysis,{inventoryCache:cache});assert.equal(JSON.parse(exported['analysis/rom-inventory.json']).cache.status,'hit');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('ROM_INVENTORY_CACHE_V043694_PASS');
