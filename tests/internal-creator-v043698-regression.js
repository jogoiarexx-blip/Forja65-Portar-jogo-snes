'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),C=require('../forja65-core'),IO=require('../tools/project-io');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-internal-creator-'));
try{
 const bytes=C.makeSyntheticRom();bytes.fill(0xea,0,64);bytes[64]=0xdb;const file=path.join(dir,'cart.sfc'),out=path.join(dir,'on');fs.writeFileSync(file,bytes);
 let result=IO.generate({romPath:file,out,max:4,globalCfgRounds:0});const initial=result.a.decoded;let prior=new Set(result.a.instructions.map(i=>i.pc));
 for(let n=0;n<8;n++){const was=result.a.decoded;result=IO.generate({romPath:file,out,max:4,globalCfgRounds:0,update:true});assert(result.a.decoded>was,'every bounded update advances while replay cap has room');for(const pc of prior)assert(result.a.instructions.some(i=>i.pc===pc));prior=new Set(result.a.instructions.map(i=>i.pc));}
 assert(result.a.decoded>initial,'normal creator updates must resume inside a budget-truncated routine');
 const report=JSON.parse(fs.readFileSync(path.join(out,'analysis/internal-replay.json')));assert(report.replayed>0);assert(report.charged<=4);assert(report.budget<=8192);
 const opts=JSON.parse(fs.readFileSync(path.join(out,'analysis/generation-options.json')));assert.equal(opts.internalReplay,true);
 const off=path.join(dir,'off');let a=IO.generate({romPath:file,out:off,max:4,globalCfgRounds:0,internalReplay:false});const count=a.a.decoded;for(let n=0;n<3;n++)a=IO.generate({romPath:file,out:off,max:4,globalCfgRounds:0,update:true});assert.equal(a.a.decoded,count,'disabled retains previous scheduling');
 assert.throws(()=>IO.generate({romPath:file,out:path.join(dir,'over'),max:4,cacheLimit:1}),/ceiling/);assert(!fs.existsSync(path.join(dir,'over')));
 console.log('INTERNAL_CREATOR_FIXED_BUDGET_GROWTH_OFF_CEILING_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
