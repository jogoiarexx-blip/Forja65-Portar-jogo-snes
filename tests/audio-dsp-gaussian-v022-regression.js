"use strict";
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-gaussian-test.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384));
const header=generated['src/runtime.hpp'];
for(const token of ['gaussianCoefficients','interpolateGaussian','Interpolation::Gaussian','previousTail','FORJA65_DSP_INTERPOLATION'])assert.ok(header.includes(token),token);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-gaussian-'));
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),generated['src/pcm_audio_output.hpp']);
  fs.copyFileSync(path.join(__dirname,'fixtures','audio_dsp_gaussian_v022.cpp'),path.join(dir,'test.cpp'));
  const bin=path.join(dir,process.platform==='win32'?'gauss-test.exe':'gauss-test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','test.cpp','-o',bin],{cwd:dir,stdio:'inherit'});
  cp.execFileSync(bin,[],{cwd:dir,stdio:'inherit'});
  console.log('FORJA65_GAUSSIAN_V022_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
