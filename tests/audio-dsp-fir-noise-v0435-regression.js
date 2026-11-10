"use strict";
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process'),assert=require('node:assert/strict');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-fir-noise-v0435.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384));
const header=generated['src/runtime.hpp'];
for(const token of ['hardwareEchoFir','hardwareNoiseTiming','hardwareVolumeScaling',
                    'FORJA65_DSP_ECHO_FIR','FORJA65_DSP_NOISE_CLOCK','FORJA65_DSP_VOLUMES'])
  assert.ok(header.includes(token),`Generated runtime missing ${token}`);
// Validate DSP behavior below; later releases retain this regression.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-fir-noise-v0435-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),generated['src/pcm_audio_output.hpp']);
 const bin=path.join(dir,process.platform==='win32'?'fir-noise.exe':'fir-noise');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra',
    path.join(__dirname,'fixtures/audio_dsp_fir_noise_v0435.cpp'),'-I'+dir,'-o',bin],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(bin,[],{cwd:dir,stdio:'inherit'});
 console.log('FORJA65_DSP_FIR_NOISE_V0435_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
