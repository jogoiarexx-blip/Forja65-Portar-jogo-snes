'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-spc-interleave-v026.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384));
const header=generated['src/runtime.hpp'];
assert.ok(generated['RUN-WINDOWS-AUDIO-INTERLEAVED.cmd'].includes('FORJA65_APU_DSP_INTERLEAVE=1'));
for(const token of ['FORJA65_APU_DSP_INTERLEAVE','interleaveSpcDsp','tickSpcMasterCycles(slice)','tickDspMasterCycles(slice)','dsp_spc_interleave='])
  assert.ok(header.includes(token),token);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-dsp-v026-'));
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),generated['src/pcm_audio_output.hpp']);
  fs.copyFileSync(path.join(__dirname,'fixtures','audio_dsp_spc_interleave_v026.cpp'),path.join(dir,'test.cpp'));
  const bin=path.join(dir,process.platform==='win32'?'interleave-test.exe':'interleave-test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','test.cpp','-o',bin],{cwd:dir,stdio:'inherit'});
  cp.execFileSync(bin,[],{cwd:dir,stdio:'inherit'});
  console.log('FORJA65_DSP_SPC_INTERLEAVE_V026_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
