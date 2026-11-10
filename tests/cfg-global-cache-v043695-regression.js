'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),C=require('../forja65-core'),IO=require('../tools/project-io');
const b=new Uint8Array(0x10000);b.set(C.makeSyntheticRom());b.set([0x22,0x00,0x80,0x81,0xdb]);for(let n=0;n<128;n++){const p=0x8000+n*16;b.set(n<127?[0x22,(p+16)&255,((p+16)>>>8)&255,0x81,0x6b]:[0x6b],p);}const rom=C.loadRom(b),base=C.analyze(rom,8),hash=C.romFingerprint(rom),cache=IO.makeCfgCache(base,hash);
assert(Array.isArray(cache.cfgFrontier)&&cache.cfgFrontier.length>0,'pending CFG frontier must be persisted in the existing cache');
const valid=C.cfgFrontierSeeds(rom,cache);assert(valid.seeds.length>0);
const wrong={...cache,rom:'0000000000000000'};assert.equal(C.cfgFrontierSeeds(rom,wrong).seeds.length,0);
assert.equal(C.cfgFrontierSeeds(rom,{...cache,cfgFrontierContext:'changed'}).seeds.length,0);
assert.equal(C.cfgFrontierSeeds(rom,{...cache,cfgFrontier:cache.cfgFrontier.map(x=>({...x,from:0x999999}))}).seeds.length,0);
assert.equal(C.cfgFrontierSeeds(rom,{...cache,cfgFrontier:cache.cfgFrontier.map(x=>({...x,state:{emulation:true,m8:false,x8:true,carry:null}}))}).seeds.length,0);
const forged=JSON.parse(JSON.stringify(cache));for(const f of forged.functions)for(const c of f.calls)c.from=0x9000;for(const r of forged.cfgFrontier)r.from=0x9000;assert.equal(C.cfgFrontierSeeds(rom,forged).seeds.length,0,'frontier source must exist as an actual decoded ROM instruction');
const forgedKind=JSON.parse(JSON.stringify(cache));for(const f of forgedKind.functions)for(const c of f.calls){c.kind='JSR-TABLE';c.target=0x819000;}for(const r of forgedKind.cfgFrontier){r.kind='JSR-TABLE';r.start=0x819000;}assert.equal(C.cfgFrontierSeeds(rom,forgedKind).seeds.length,0,'indirect kind must not bypass direct ROM instruction evidence');
const forgedTarget=JSON.parse(JSON.stringify(cache));for(const f of forgedTarget.functions){for(const c of f.calls)c.target=0x819000;for(const i of f.instructions)if(i.mnemonic==='JSL')i.flowTarget=0x819000;}for(const r of forgedTarget.cfgFrontier)r.start=0x819000;assert.equal(C.cfgFrontierSeeds(rom,forgedTarget).seeds.length,0,'cached flowTarget must be rederived from ROM, not trusted');
const changedKnowledge={schema:'forja65.knowledge.v1',entries:[],dataRegions:[{start:0x818000,end:0x818fff}]};assert.equal(C.cfgFrontierSeeds(rom,cache,changedKnowledge).seeds.length,0);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-global-cache-'));
try{
 const file=path.join(dir,'cart.sfc'),out=path.join(dir,'game');fs.writeFileSync(file,b);
 const first=IO.generate({romPath:file,out,max:8,globalCfgBudget:64});assert(first.a.decoded>base.decoded,'game creator must expand known pending calls before first execution');assert(first.a.rieGlobal.expansionRounds>0);
 const frontier=JSON.parse(fs.readFileSync(path.join(out,'analysis/cfg-coverage-cache.json')));assert(Array.isArray(frontier.cfgFrontier));
 const prior=new Set(first.a.functions.flatMap(f=>f.instructions.map(i=>i.pc+'|'+i.stateSig)));
 const second=IO.generate({romPath:file,out,max:8,globalCfgBudget:64,update:true});const after=new Set(second.a.functions.flatMap(f=>f.instructions.map(i=>i.pc+'|'+i.stateSig)));for(const k of prior)assert(after.has(k));assert(second.a.decoded>first.a.decoded,'update must advance beyond the previous pending frontier');assert(second.a.rieGlobal.cacheImport.accepted>0);assert.equal(second.a.rieGlobal.initialDecoded,first.a.decoded,'update baseline must include retained persistent coverage');assert.equal(second.a.rieGlobal.initialDecoded+second.a.rieGlobal.addedInstructions,second.a.decoded,'global report must match merged coverage');
 assert.equal(second.a.cfgFrontier.length,JSON.parse(fs.readFileSync(path.join(out,'analysis/cfg-global.json'))).frontier.length);
 const stopOut=path.join(dir,'no-global');const stopped=IO.generate({romPath:file,out:stopOut,max:8,globalCfg:false,useKnowledgeVault:false});assert.equal(stopped.a.decoded,C.analyze(rom,8,[],{globalCfg:false}).decoded);
 assert(!stopped.a.rieGlobal);
 assert.throws(()=>IO.generate({romPath:file,out:path.join(dir,'too-small'),max:8,cacheLimit:1}),/ceiling/);assert(!fs.existsSync(path.join(dir,'too-small')));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('CFG_GLOBAL_CACHE_V043695_PASS');

const stack=C.makeSyntheticRom();stack.set([0x9a,0xf4,0xff,0x81,0xdb]);stack[0x200]=0x60;const sr=C.loadRom(stack),sa=C.analyze(sr,3);assert(sa.cfgFrontier.some(q=>q.kind==='STACK-PEA-BOOTSTRAP'));const sc=IO.makeCfgCache(sa,C.romFingerprint(sr));assert.equal(C.cfgFrontierSeeds(sr,sc).seeds.length,0,'cached inferred stack targets require fresh dataflow, not cached metadata');const sm=C.analyze(sr,3,[],{globalCfgRounds:1,globalCfgBudget:16});assert(sm.functions.some(f=>f.start===0x8200),'live inferred stack target must reuse existing decoder before generation');const publicResult=C.refreshCfgGlobal(sr,sa,true);assert(!publicResult.cfgFrontier.some(q=>q.kind==='STACK-PEA-BOOTSTRAP'),'public refresh cannot enable trusted-live inference');
console.log('CFG_GLOBAL_LIVE_CACHE_BOUNDARY_PASS');
