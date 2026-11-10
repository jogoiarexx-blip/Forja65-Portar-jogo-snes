'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require(process.env.FORJA_BASELINE_CORE||'../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-flg-internal-reset-v043649.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dsp-flg-v043649-'));
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),project['src/runtime.hpp']);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
  const binary=path.join(dir,process.platform==='win32'?'test.exe':'test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-I'+dir,path.join(__dirname,'fixtures','dsp_flg_internal_reset_v043649.cpp'),'-o',binary],{cwd:dir,stdio:'pipe',timeout:180000});
  const out=cp.execFileSync(binary,[],{cwd:dir,encoding:'utf8',timeout:90000});
  assert.match(out,/DSP_FLG_INTERNAL_RESET_V043649_PASS cases=1088/);
  console.log(out.trim());
}finally{fs.rmSync(dir,{recursive:true,force:true});}
