'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const rom=F.loadRom(F.makeSyntheticRom(),'crossfeed-synthetic.sfc');
const files=F.generateProject(rom,F.analyze(rom,256));
const runtime=files['src/runtime.hpp'],dispatch=files['src/dispatch.cpp'];
for(const s of ['autoJoyReadBusy','pollAutoJoypad','saveSpcTraceTail','correctedSpcSemantics','sceneTimelineFrames'])assert.ok(runtime.includes(s),s);
for(const s of ['forja65_try_wram_blockmove_rtl','hw.romOffset(requested)','0xDCu'])assert.ok(dispatch.includes(s),s);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-crossfeed-multigame-'));
try{
 for(const [n,t] of Object.entries(files)){
  if(!n.startsWith('src/'))continue;
  const p=path.join(tmp,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,t);
 }
 const src=path.join(tmp,'src');const cc=Object.keys(files).filter(n=>n==='src/dispatch.cpp'||/^src\/generated_.*\.cpp$/.test(n));
 assert.ok(cc.includes('src/dispatch.cpp'));
 const r=cp.spawnSync(process.env.CXX||'g++',['-std=c++20','-O0','-Werror','-DFORJA65_ENABLE_TRACE=0','-fsyntax-only','-I',src,...cc.map(n=>path.join(tmp,n))],{encoding:'utf8',timeout:90000});
 assert.equal(r.status,0,r.error?.message||r.stderr||r.stdout);
 console.log('CROSSFEED_MULTIGAME_GENERATION_CPP_SYNTAX_PASS '+cc.length+' source files');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
