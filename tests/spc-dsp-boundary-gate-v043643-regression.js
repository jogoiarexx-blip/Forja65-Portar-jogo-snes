'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'spc-dsp-boundary-v043643.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384));
const header=generated['src/runtime.hpp'];
assert.ok(header.includes('spc_dsp_boundary_gate='));
assert.ok(header.includes('(strictSpcScheduler||interleaveSpcDsp)'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-dsp-boundary-v043643-'));
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),generated['src/pcm_audio_output.hpp']);
  fs.copyFileSync(path.join(__dirname,'fixtures','spc_dsp_boundary_gate_v043643.cpp'),path.join(dir,'test.cpp'));
  const bin=path.join(dir,process.platform==='win32'?'boundary.exe':'boundary');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','test.cpp','-o',bin],{cwd:dir,stdio:'inherit',timeout:120000});
  const output=cp.execFileSync(bin,[],{cwd:dir,encoding:'utf8',timeout:120000});
  assert.match(output,/SPC_DSP_BOUNDARY_GATE_V043643_PASS/);
  console.log(output.trim());
}finally{fs.rmSync(dir,{recursive:true,force:true});}
