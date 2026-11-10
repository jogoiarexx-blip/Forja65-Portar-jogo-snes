'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-fractional-v025.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384));
const header=generated['src/runtime.hpp'];
assert.ok(generated['RUN-WINDOWS-AUDIO-LEGACY-CLOCK.cmd'].includes('FORJA65_DSP_CLOCK=legacy'));
assert.ok(header.includes('dsp_clock_mode='));
for(const token of ['DSP_MASTER_HZ','DSP_OUTPUT_RATE_HZ','legacyDspClock','FORJA65_DSP_CLOCK','dspMasterRemainder'])assert.ok(header.includes(token),token);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dsp-clock-v025-'));
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),generated['src/pcm_audio_output.hpp']);
  fs.copyFileSync(path.join(__dirname,'fixtures','audio_dsp_fractional_clock_v025.cpp'),path.join(dir,'test.cpp'));
  const bin=path.join(dir,process.platform==='win32'?'clock-test.exe':'clock-test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','test.cpp','-o',bin],{cwd:dir,stdio:'inherit'});
  // REV195: o padrao segue o relogio do SPC (32.040 Hz); este teste mede o relogio nominal de 32 kHz.
  cp.execFileSync(bin,[],{cwd:dir,stdio:'inherit',env:{...process.env,FORJA65_DSP_RATE:'32000'}});
  console.log('FORJA65_DSP_FRACTIONAL_CLOCK_V025_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
