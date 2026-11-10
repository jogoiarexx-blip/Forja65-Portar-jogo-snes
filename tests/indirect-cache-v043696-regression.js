'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core'),IO=require('../tools/project-io');
const b=C.makeSyntheticRom();b.set([0xa2,4,0x7c,0,0x90]);b.set([0,0x82],0x1004);b.set([0xa9,0x42,0xdb],0x200);const rom=C.loadRom(b),hash=C.romFingerprint(rom),a=C.analyze(rom,2),cache=IO.makeCfgCache(a,hash);
assert(cache.cfgFrontier.some(x=>x.start===0x8200));assert(C.cfgFrontierSeeds(rom,cache).seeds.some(x=>x.start===0x8200),'indirect pending frontier must revalidate its local witness and resume from cache');
console.log('INDIRECT_CACHE_V043696_PASS');
const clone=()=>JSON.parse(JSON.stringify(cache));
function reject(change,label){const c=clone();change(c);assert(!C.cfgFrontierSeeds(rom,c).seeds.some(x=>x.start===c.cfgFrontier[0]?.start),label);}
reject(c=>{for(const f of c.functions){for(const call of f.calls)call.target=0x8300;for(const i of f.instructions)if(i.rieIndirect){i.rieIndirect.targets=[0x8300];i.indirectTargets=[0x8300];}}for(const r of c.cfgFrontier)r.start=0x8300;},'cached target lists cannot override ROM table bytes');
reject(c=>{for(const f of c.functions)for(const i of f.instructions)if(i.rieIndirect?.witness?.length)i.rieIndirect.witness[0].raw[1]=6;},'witness raw mismatch rejected');
reject(c=>{for(const f of c.functions)for(const i of f.instructions)if(i.rieIndirect?.witness?.length)i.rieIndirect.witness[0].state={emulation:true,m8:false,x8:true,carry:null};},'impossible E/M/X witness rejected');
reject(c=>{for(const f of c.functions)for(const i of f.instructions)if(i.rieIndirect?.witness?.length)i.rieIndirect.witness[1].state.x8=false;},'disconnected CPU state transition rejected');
reject(c=>{for(const f of c.functions)for(const i of f.instructions)if(i.rieIndirect?.witness?.length)i.rieIndirect.witness=Array(65).fill(i.rieIndirect.witness[0]);},'witness budget is absolute');
reject(c=>{c.rom='0000000000000000';},'wrong ROM rejected');reject(c=>{c.cfgFrontierContext='different';},'wrong assumptions rejected');
const disconnected=b.slice();disconnected.set([0xa2,4],0x100);const dr=C.loadRom(disconnected),dc=clone();dc.rom=C.romFingerprint(dr);for(const f of dc.functions)for(const i of f.instructions)if(i.rieIndirect?.witness?.length)i.rieIndirect.witness[0].pc=0x8100;assert.equal(C.cfgFrontierSeeds(dr,dc).seeds.length,0,'real bytes at another address do not form a connected witness');
const changed=b.slice();changed[0x1005]=0x83;const rr=C.loadRom(changed),cc=clone();cc.rom=C.romFingerprint(rr);assert.equal(C.cfgFrontierSeeds(rr,cc).seeds.length,0,'changed table must derive new value rather than reuse old target');
const files=C.generateProject(rom,a),report=JSON.parse(files['analysis/indirect-targets.json']);assert(report.resolvedPathSites>0);assert.equal(report.executionValidatedSites,0);assert(report.sites.some(x=>x.address===0x8002&&x.revalidation.targets.includes(0x8200)));
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-indirect-cache-'));
try{const data=C.makeSyntheticRom();data.set([0xa2,0,0x7c,0,0x90]);data.set([0xa2,2,0x7c,0,0x90],0x200);data.set([0xa2,4,0x7c,0,0x90],0x300);data.set([0xa9,0x42,0xdb],0x400);data.set([0,0x82,0,0x83,0,0x84],0x1000);const file=path.join(dir,'cart.sfc'),out=path.join(dir,'game');fs.writeFileSync(file,data);
 const first=IO.generate({romPath:file,out,max:4,globalCfgRounds:0}),old=new Set(first.a.functions.flatMap(f=>f.instructions.map(i=>i.pc+'|'+i.stateSig)));
 assert(first.a.cfgFrontier.some(r=>r.start===0x8300));const second=IO.generate({romPath:file,out,max:4,globalCfgRounds:0,update:true}),now=new Set(second.a.functions.flatMap(f=>f.instructions.map(i=>i.pc+'|'+i.stateSig)));for(const k of old)assert(now.has(k));assert(second.a.decoded>first.a.decoded);assert(second.a.rieGlobal.cacheImport.accepted>0,'creator must import proof-backed indirect frontier');
 const opts=JSON.parse(fs.readFileSync(path.join(out,'analysis/generation-options.json')));assert.equal(opts.indirectRie,true);assert(JSON.parse(fs.readFileSync(path.join(out,'analysis/indirect-targets.json'))).resolvedPathSites>0);
 // REV136: the knowledge vault (v.112) carries the earlier runs' RIE coverage of this ROM into any new
 // project; isolate it so this checks the indirectRie switch itself.
 const off=IO.generate({romPath:file,out:path.join(dir,'off'),max:4,indirectRie:false,globalCfgRounds:0,useKnowledgeVault:false});assert(!off.a.functions.some(f=>f.start===0x8200));assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'off/analysis/generation-options.json'))).indirectRie,false);
 assert.throws(()=>IO.generate({romPath:file,out:path.join(dir,'over'),max:4,cacheLimit:1}),/ceiling/);assert(!fs.existsSync(path.join(dir,'over')));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('INDIRECT_WITNESS_TAMPER_UPDATE_REPORT_PASS');
