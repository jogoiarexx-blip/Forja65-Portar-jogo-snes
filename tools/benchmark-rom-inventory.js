#!/usr/bin/env node
'use strict';
const C=require('../forja65-core'),{performance}=require('node:perf_hooks'),fs=require('node:fs');
const rows=[];for(const [mapping,size]of [['LoROM',1024*1024],['HiROM',3*1024*1024],['ExHiROM',6*1024*1024]]){
 const d=new Uint8Array(size);let x=73;for(let p=0;p<size;p++){x=(Math.imul(x,1664525)+1013904223)>>>0;d[p]=x>>>24;}for(const h of [0x7fc0,0xffc0,0x40ffc0])if(h+64<=size)d.fill(0,h,h+64);
 const h=mapping==='LoROM'?0x7fc0:mapping==='HiROM'?0xffc0:0x40ffc0;d.fill(32,h,h+21);d.set(Buffer.from('RIE BENCH'),h);d[h+21]=mapping==='LoROM'?0x20:mapping==='HiROM'?0x21:0x25;d[h+23]=10;d[h+28]=0xcb;d[h+29]=0xed;d[h+30]=0x34;d[h+31]=0x12;d[h+60]=0;d[h+61]=0x80;
 const r=C.loadRom(d);r.data[C.snesToRom(r,0x8000)]=0xdb;
 const store=new Map(),cache={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};const startMem=process.memoryUsage();let t=performance.now();const base=C.analyze(r,512,[],{romInventory:false});const baselineMs=performance.now()-t;
 t=performance.now();const cold=C.analyze(r,512,[],{inventoryCache:cache});const coldMs=performance.now()-t;
 t=performance.now();const warm=C.analyze(r,512,[],{inventoryCache:cache});const warmMs=performance.now()-t;
 const after=process.memoryUsage();rows.push({mapping,size,baselineMs,coldMs,warmMs,coldScannedBytes:cold.romInventory.metrics.physicalBytesScanned,warmScannedBytes:warm.romInventory.metrics.physicalBytesScanned,pagesReused:warm.romInventory.metrics.pagesReused,cacheSerializedBytes:[...store.values()].reduce((n,v)=>n+Buffer.byteLength(v),0),temporaryByteArrays:cold.romInventory.metrics.temporaryByteArrays,processRssDelta:after.rss-startMem.rss,processArrayBuffersDelta:after.arrayBuffers-startMem.arrayBuffers,baselineFunctions:base.functions.length,rieFunctions:cold.functions.length,identifiedCodeBytes:cold.romInventory.metrics.identifiedCodeBytes});
}
const result={environment:{node:process.version,platform:process.platform,arch:process.arch},method:'One sample per case; timings include the mandatory ROM identity hash and existing CFG. Concurrent regression workloads can affect timing; RSS deltas are not peak memory.',rows};
const json=JSON.stringify(result,null,2)+'\n';if(process.argv[2])fs.writeFileSync(process.argv[2],json);else process.stdout.write(json);
