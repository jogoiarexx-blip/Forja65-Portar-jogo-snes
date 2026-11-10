'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require(process.env.FORJA_BASELINE_CORE||'../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-esa-sample-latch-v043648.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dsp-esa-v043648-'));
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),project['src/runtime.hpp']);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
  const binary=path.join(dir,process.platform==='win32'?'test.exe':'test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-I'+dir,path.join(__dirname,'fixtures','dsp_esa_sample_latch_v043648.cpp'),'-o',binary],{cwd:dir,stdio:'pipe',timeout:180000});
  const out=cp.execFileSync(binary,[],{cwd:dir,encoding:'utf8',timeout:90000});
  assert.match(out,/DSP_ESA_SAMPLE_LATCH_V043648_PASS cases=\d+/);
  console.log(out.trim());
}finally{fs.rmSync(dir,{recursive:true,force:true});}
