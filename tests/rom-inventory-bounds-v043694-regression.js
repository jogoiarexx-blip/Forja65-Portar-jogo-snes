'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core');
const d=new Uint8Array(0x8001);d.set(C.makeSyntheticRom());const r=C.loadRom(d),i=C.inventoryRom(r,null,{maxMappingWindows:32});
assert.equal(i.mapping.complete,false);assert(i.truncated.bankWindows>0);assert.equal(i.metrics.unmappedPhysicalBytes,null);assert(i.banks.reduce((n,b)=>n+b.windows.length,0)<=32);
const rom=C.loadRom(C.makeSyntheticRom()),a=C.analyze(rom,128);assert(!C.generateProject(rom,a,{romInventory:false})['analysis/rom-inventory.json']);
// CPU operand fetch wraps inside PB and cannot mark adjacent physical bytes.
const f={start:0x40ffff,entryState:{emulation:true,m8:true,x8:true},instructions:[{pc:0x40ffff,size:3,status:'native'}],calls:[]};const wrap=C.inventoryRom(rom,{functions:[f]});assert.equal(wrap.metrics.identifiedCodeBytes,3);
const codeOffsets=[C.snesToRom(rom,0x40ffff),C.snesToRom(rom,0x400000),C.snesToRom(rom,0x400001)];for(const off of codeOffsets)assert(wrap.regions.some(v=>v.start<=off&&v.end>off&&(v.classification==='probableCode'||v.evidence==='code-data-conflict')));
console.log('ROM_INVENTORY_BOUNDS_V043694_PASS');
