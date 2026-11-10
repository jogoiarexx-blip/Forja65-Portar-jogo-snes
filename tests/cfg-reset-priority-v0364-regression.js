'use strict';
const assert=require('node:assert/strict'),F=require('../forja65-core');
const src=F.makeSyntheticRom();
src.fill(0xEA,0,0x400);src[0]=0xDB;src[0x3ff]=0xDB;
const rom=F.loadRom(src,'reset-first.sfc');
const hints=[{target:0x8100,from:0x8080,kind:'FLOW',state:{emulation:false,m8:false,x8:false,carry:null}},
{target:0x8200,from:0x8081,kind:'FLOW',state:{emulation:false,m8:false,x8:false,carry:null}}];
const a=F.analyze(rom,24,hints);
assert(a.functions.length>0,'No functions generated');
assert(a.functions.some(f=>f.start===a.resetPc&&f.entryName==='RESET'),'RESET must be included even when hot hints exhaust global budget');
assert(a.functions.some(f=>f.start===0x8200),'Recent runtime hint must follow RESET before speculative CFG');
const files=F.generateProject(rom,a);
assert(files['src/main.cpp'].includes('forja65_dispatch(cpu,hw,0x008000u'), 'Generated game must enter from RESET');
console.log('CFG_RESET_PRIORITY_V0364_PASS',{functions:a.functions.length, reset:a.resetPc, variants:a.functions.reduce((n,f)=>n+f.instructions.length,0)});
