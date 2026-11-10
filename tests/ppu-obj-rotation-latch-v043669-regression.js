'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const F=require(process.env.FORJA65_SOURCE_CORE||'../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom(),'ppu-obj-rotation-latch-v043669.sfc');
const files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-obj-rotation-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
 const fixture=path.join(__dirname,'fixtures','ppu_obj_rotation_latch_v043669.cpp');
 for(const opt of (process.env.FORJA65_TEST_LEVELS||'-O0,-O2').split(',')){
  assert.ok(['-O0','-O1','-O2'].includes(opt));
  const exe=path.join(dir,process.platform==='win32'?'probe.exe':'probe');
  const args=['-std=c++20',opt,...(process.env.FORJA65_TRACE_DISABLED==='1'?['-DFORJA65_ENABLE_TRACE=0']:[]),'-I'+dir,fixture,'-o',exe];
  cp.execFileSync(process.env.CXX||'g++',args,{timeout:120000,cwd:dir,stdio:'pipe'});
  const result=cp.execFileSync(exe,[],{timeout:60000,cwd:dir,encoding:'utf8'});
  assert.match(result,/PPU_OBJ_ROTATION_LATCH_V043669_PASS cases=28/);
  console.log(opt,result.trim());
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
