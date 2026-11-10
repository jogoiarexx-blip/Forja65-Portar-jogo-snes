#!/usr/bin/env node
'use strict';
// Hardware-focused regression gate. This is not an overall SNES accuracy score.
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const matrix=[
 ['CPU','cpu-5a22-math-v0436128-regression.js'],
 ['CPU','cpu-io-openbus-v0436122-regression.js'],
 ['CPU','cpu-generated-differential-v043618-regression.js'],
 ['PPU+SRAM','hardware-bus-sram-v0436127-regression.js'],
 ['PPU','ppu1-open-bus-stat77-v043665-regression.js'],
 ['PPU','ppu2-open-bus-dma-v043660-regression.js'],
 ['PPU','ppu-cgram-shared-byte-latch-v043663-regression.js'],
 ['SRAM','cartridge-flow-sram-v033-regression.js'],
 ['SRAM','sram-save-v0436-regression.js'],
 ['DMA+HDMA','dma-hdma-preemption-v0436123-regression.js'],
 ['DMA+HDMA','dma-hdma-indirect-das-v0436124-regression.js'],
 ['SPC700','spc-timer-fast-forward-v043682-regression.js'],
 ['SPC700','spc-halted-timers-v043639-regression.js'],
 ['CFG/RIE','cfg-cache-autogrow-rev126.js'],
];
const full=process.argv.includes('--full');
const chosen=full?matrix:matrix.filter(([domain,name])=>
  ['cpu-5a22-math-v0436128-regression.js','cpu-io-openbus-v0436122-regression.js','hardware-bus-sram-v0436127-regression.js',
   'dma-hdma-indirect-das-v0436124-regression.js','spc-timer-fast-forward-v043682-regression.js',
   'cfg-cache-autogrow-rev126.js'].includes(name));
const result={schema:1,revision:'REV128',kind:'selected_regression_suite_not_game_compatibility',
  full,createdAt:new Date().toISOString(),suites:[]};
for(const [domain,name]of chosen){
 const time=Date.now();
 const r=cp.spawnSync(process.execPath,[path.join(root,'tests',name)],{
   cwd:root,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024
 });
 const pass=r.status===0&&!r.error;
 const tail=((r.stdout||'')+'\n'+(r.stderr||'')).trim().slice(-900);
 result.suites.push({domain,test:name,pass,durationMs:Date.now()-time,exitCode:r.status,error:r.error?String(r.error):undefined,outputTail:tail});
 console.log(`${pass?'PASS':'FAIL'} [${domain}] ${name}`);
}
result.summary={passed:result.suites.filter(s=>s.pass).length,total:result.suites.length,
  scoreSelectedSuites10:+(10*result.suites.filter(s=>s.pass).length/result.suites.length).toFixed(2)};
const arg=process.argv.indexOf('--out');
const out=arg>=0&&process.argv[arg+1]?path.resolve(process.argv[arg+1]):path.join(root,'reports','hardware-scorecard-v0436128.json');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(`REPORT ${out} selected_suite_score=${result.summary.scoreSelectedSuites10}/10`);
if(result.summary.passed!==result.summary.total)process.exitCode=1;
