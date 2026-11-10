'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-envelope-output-v043683.sfc');
const generated=F.generateProject(rom,F.analyze(rom,128));
const header=generated['src/runtime.hpp'];
assert.match(header,/v0\.4\.36\.83: S-DSP voice output/);
assert.match(header,/FORJA65_DSP_ENV_OUTPUT/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dsp-envout83-'));
try {
 fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),generated['src/pcm_audio_output.hpp']);
 const cpp=path.join(__dirname,'fixtures','dsp_envelope_output_scaling_v043683.cpp');
 for(const flags of (process.env.FORJA65_TEST_LEVELS||'-O0,-O2').split(',')){
  assert.ok(['-O0','-O1','-O2'].includes(flags));
  const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',flags,'-I'+dir,cpp,'-o',exe],{cwd:dir,stdio:'pipe',timeout:180000});
  const log=cp.execFileSync(exe,[],{cwd:dir,encoding:'utf8',timeout:90000});
  assert.match(log,/DSP_ENVELOPE_OUTPUT_V043683_PASS checks=\d+/);
  console.log(flags,log.trim());
 }
} finally {fs.rmSync(dir,{recursive:true,force:true});}
