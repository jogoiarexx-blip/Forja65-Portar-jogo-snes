'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const F=require(process.env.FORJA65_SOURCE_CORE||'../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom(),'ppu-obj-chr-latch-v043675.sfc');
const files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-obj-chr-latch-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
 const fixture=path.join(__dirname,'fixtures','ppu_obj_chr_latch_v043675.cpp');
 for(const opt of (process.env.FORJA65_TEST_LEVELS||'-O0,-O2').split(',')){
  assert.ok(['-O0','-O1','-O2'].includes(opt));
  const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
  const flags=['-std=c++20',opt,...(process.env.FORJA65_TRACE_DISABLED==='1'?['-DFORJA65_ENABLE_TRACE=0']:[]),'-I'+dir,fixture,'-o',exe];
  cp.execFileSync(process.env.CXX||'g++',flags,{timeout:120000,cwd:dir,stdio:'pipe'});
  // Select this historical fixture's documented v74/v75 renderer mode only
  // for the child executable; current v76 tests retain their defaults.
  const result=cp.execFileSync(exe,[],{timeout:60000,cwd:dir,encoding:'utf8',env:{...process.env,FORJA65_OBJ_LEGACY_HIRES_INTERLACE:'1',FORJA65_OBJ_LIVE_CHR:'0'}});
  assert.match(result,/PPU_OBJ_CHR_LATCH_V043675_PASS cases=\d+/);
  console.log(opt,result.trim());
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
