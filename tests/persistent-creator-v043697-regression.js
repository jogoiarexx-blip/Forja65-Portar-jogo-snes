'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),C=require('../forja65-core'),IO=require('../tools/project-io');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-persistent-creator-'));
try {
 const b=C.makeSyntheticRom();b.set([0xa9,0x42,0xdb]);const file=path.join(dir,'cart.sfc'),out=path.join(dir,'game');fs.writeFileSync(file,b);
 let computes=0;const analyze=C.analyze;C.analyze=(...args)=>{computes++;return analyze(...args);};
 const first=IO.generate({romPath:file,out,max:32,globalCfgRounds:0});const before=fs.readFileSync(path.join(out,'src/generated_003.cpp'),'utf8');
 let last;for(let n=0;n<3;n++)last=IO.generate({romPath:file,out,max:32,globalCfgRounds:0,update:true});
 const report=()=>JSON.parse(fs.readFileSync(path.join(out,'analysis/persistent-analysis.json')));
 assert(report().memo.hits>0,'steady update must reuse exact decode result');assert(computes<4,'cache skips existing analyzer work');assert.equal(fs.readFileSync(path.join(out,'src/generated_003.cpp'),'utf8'),before,'warm native output identical');assert.equal(report().identity.romSha256.length,64);assert(report().history.length<=32);assert.equal(report().coverage.executionValidatedBytes,0);
 const count=computes;IO.generate({romPath:file,out,max:32,globalCfgRounds:0,update:true,indirectRie:false});assert(computes>count,'changed assumptions force analysis');assert.equal(report().memo.hits,0);
 const off=path.join(dir,'off');IO.generate({romPath:file,out:off,max:32,globalCfgRounds:0,persistentAnalysis:false});assert.equal(JSON.parse(fs.readFileSync(path.join(off,'analysis/persistent-analysis.json'))).memo.enabled,false);assert(!fs.existsSync(path.join(off,'analysis/rie-analysis-cache')));
 assert.throws(()=>IO.generate({romPath:file,out:path.join(dir,'rejected'),max:32,cacheLimit:1}),/ceiling/);assert(!fs.existsSync(path.join(dir,'rejected')));
 C.analyze=analyze;
 // Frontier identity changes as coverage grows; memoization must not freeze it.
 b.set([0xa2,0,0x7c,0,0x90]);b.set([0xa2,2,0x7c,0,0x90],0x200);b.set([0xa2,4,0x7c,0,0x90],0x300);b.set([0xdb],0x400);b.set([0,0x82,0,0x83,0,0x84],0x1000);fs.writeFileSync(file,b);
 const chain=path.join(dir,'chain');let a=IO.generate({romPath:file,out:chain,max:4,globalCfgRounds:0});const pcs=new Set(a.a.instructions.map(i=>i.pc));let grew=false;
 for(let n=0;n<4;n++){const prior=a.a.decoded;a=IO.generate({romPath:file,out:chain,max:4,globalCfgRounds:0,update:true});grew||=a.a.decoded>prior;for(const pc of pcs)assert(a.a.instructions.some(i=>i.pc===pc));}
 assert(grew,'pending indirect chain continues across updates');const history=JSON.parse(fs.readFileSync(path.join(chain,'analysis/persistent-analysis.json'))).history;assert(history.some(h=>h.newAddressCount>0));
 console.log('PERSISTENT_CREATOR_REUSE_NATIVE_EQUALITY_INVALIDATION_INCREMENTAL_PASS');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
