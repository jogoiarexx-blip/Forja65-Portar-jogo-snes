'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('../forja65-core');
assert.equal(typeof C.inventoryRom,'function');
function make(mapping='LoROM',size=0x10000){
 const d=new Uint8Array(size);let v=13;for(let n=0;n<size;n++){v=(Math.imul(v,1664525)+1013904223)>>>0;d[n]=v>>>24;}
 const h=mapping==='LoROM'?0x7fc0:mapping==='HiROM'?0xffc0:0x40ffc0;
 // Prevent a random second header from competing with the intentional one.
 for(const off of [0x7fc0,0xffc0,0x40ffc0])if(off+64<=size)d.fill(0,off,off+64);
 d.fill(32,h,h+21);d.set(Buffer.from('RIE SYNTHETIC'),h);d[h+21]=mapping==='LoROM'?0x20:mapping==='HiROM'?0x21:0x25;d[h+23]=5;
 d[h+28]=0xcb;d[h+29]=0xed;d[h+30]=0x34;d[h+31]=0x12;d[h+60]=0;d[h+61]=0x80;
 const r=C.loadRom(d);r.data[C.snesToRom(r,0x8000)]=0xdb;return r;
}
function checkPartition(inv){let total=0,last=0;for(const r of inv.regions){assert.equal(r.start,last);assert(r.end>r.start);last=r.end;total+=r.end-r.start;}if(!inv.truncated.regions)assert.equal(total,inv.rom.size);assert.equal(Object.values(inv.classificationBytes).reduce((a,b)=>a+b,0),inv.rom.size);}
for(const [m,size]of [['LoROM',0x18000],['HiROM',0x30000],['ExHiROM',0x600000]]){
 const rom=make(m,size),inv=C.inventoryRom(rom);assert.equal(inv.mapping.kind,m);assert.equal(inv.metrics.inventoriedBytes,size);checkPartition(inv);
 assert(inv.banks.length>100);assert(inv.banks.every(b=>b.bank!==0x7e&&b.bank!==0x7f));
 for(const b of inv.banks)for(const w of b.windows){assert.equal(C.snesToRom(rom,w.start),w.romStart);assert.equal(C.snesToRom(rom,w.end-1),w.romStart+w.end-w.start-1);}
 assert.equal(inv.classificationBytes.probableCode,0);assert.equal(inv.classificationBytes.confirmedCode,0);assert(inv.classificationBytes.unknown>size/2);assert.equal(inv.metrics.executionValidatedBytes,0);
 assert(inv.vectors.some(v=>v.name==='RESET'&&v.target===0x8000&&v.valid));
 assert.equal(inv.rom.fnv1a64,C.romFingerprint(rom));assert.equal(inv.inputs.dataRegions.length,0);
}
{
 const r=make('LoROM',0x10000);r.data.set([0x5c,0x00,0x80,0x81],0);r.data[0x8000]=0xdb;
 const a=C.analyze(r,100);assert(a.romInventory.references.some(e=>e.from===0x8000&&e.target===0x818000&&e.interbank&&e.evidence==='existing-cfg-edge'),'direct JML edges must appear as cross-bank references');
}
{
 const r=make(),withCopier=new Uint8Array(r.data.length+512);withCopier.set(r.data,512);
 const inv=C.inventoryRom(C.loadRom(withCopier));assert(inv.rom.copierHeader);assert.equal(inv.rom.fnv1a64,C.romFingerprint(r));
 r.data.fill(0,0x1000,0x1200);const i=C.inventoryRom(r);assert(i.regions.some(v=>v.start<=0x1000&&v.end>=0x1200&&v.classification==='data'&&v.evidence==='uniform-padding'));
}
{
 const r=make('LoROM',0x20000);r.data.set([0x18,0xfb,0xc2,0x30,0xa9,0x34,0x12,0x22,0x00,0x80,0x81,0xdb],0);r.data.set([0xa9,0x78,0x56,0x6b],0x8000);
 const a=C.analyze(r,256,[],{summaryRounds:3}),b=C.analyze(r,256,[],{summaryRounds:3,romInventory:false});
 assert.deepEqual(a.functions,b.functions);assert.deepEqual(a.issues,b.issues);assert(!b.romInventory);
 const i=a.romInventory;assert(i.metrics.identifiedCodeBytes>=16);assert(i.metrics.translatableBytes>0);assert.equal(i.metrics.executionValidatedBytes,0);assert(i.references.some(x=>x.from===0x8007&&x.target===0x818000&&x.interbank));
 assert(i.functions.some(f=>!f.state.emulation&&!f.state.m8&&!f.state.x8));checkPartition(i);
 const conflict=C.inventoryRom(r,a,{dataRegions:[{start:0x808000,end:0x808003,source:'test-table'}]});assert(conflict.metrics.conflictBytes>=4);assert(conflict.regions.some(v=>v.evidence==='code-data-conflict'));
 const dup={...a,functions:[...a.functions,...a.functions]};assert.equal(C.inventoryRom(r,dup).metrics.identifiedCodeBytes,i.metrics.identifiedCodeBytes);
 const files=C.generateProject(r,a);assert(files['analysis/rom-inventory.json']);assert(files['analysis/rom-inventory.md']);assert(C.reportText(a).includes('ROM Intelligence'));
 const exported=JSON.parse(files['analysis/rom-inventory.json']);assert.equal(exported.metrics.identifiedCodeBytes,i.metrics.identifiedCodeBytes);
 // Project generation must use the final CFG, not a stale inventory made before a cache merge.
 const changed={...a,functions:a.functions.filter(f=>f.start===0x8000).map(f=>({...f,instructions:f.instructions.slice(0,1)}))};assert.equal(JSON.parse(C.generateProject(r,changed)['analysis/rom-inventory.json']).metrics.identifiedCodeBytes,1);
}
{
 const r=make();r.header.sramBytes=8192;r.header.sramSize=3;
 const i=C.inventoryRom(r);assert(!i.banks.some(b=>b.bank===0x70||b.bank===0xf0));
 r.header.romSize=12;assert(C.inventoryRom(r).banks.find(b=>b.bank===0x70).windows.every(w=>(w.start&0xffff)>=0x8000));
 r.header.sramBytes=0;r.header.coprocessor='DSP1';const dsp=C.inventoryRom(r);assert(!dsp.banks.some(b=>b.bank===0x20||b.bank===0xa0));
 r.header.coprocessor='SA1';assert.equal(C.inventoryRom(r).mapping.scope,'base-mapper-only');
}
{
 const r=make(),inv=C.inventoryRom(r,null,{maxRegions:2,maxRecords:1});assert(inv.truncated.regions>0);assert(inv.regions.length<=2);assert(inv.vectors.length<=1);checkPartition(inv);
 const unknown=C.inventoryRom({...r,header:{...r.header,mapping:'Unknown'}});assert.equal(unknown.banks.length,0);assert.equal(unknown.mapping.scope,'unsupported');
 const box={console,TextEncoder,TextDecoder};vm.runInNewContext(fs.readFileSync(require.resolve('../forja65-core'),'utf8'),box);const browser=box.Forja65Core;assert.equal(browser.inventoryRom(browser.loadRom(browser.makeSyntheticRom())).schema,inv.schema);
}
console.log('ROM_INVENTORY_V043694_PASS');
