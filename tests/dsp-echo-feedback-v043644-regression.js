'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-echo-feedback-v043644.sfc');
const project=F.generateProject(rom,F.analyze(rom,192));
const runtime=project['src/runtime.hpp'];
assert.match(runtime,/S-DSP feedback uses signed arithmetic >>7/);
assert.match(runtime,/clamp16\(writeL\)/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-echo-feedback-v043644-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),runtime);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
 const source=path.join(__dirname,'fixtures','dsp_echo_feedback_v043644.cpp');
 const out=path.join(dir,process.platform==='win32'?'run.exe':'run');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-I'+dir,source,'-o',out],{cwd:dir,stdio:'inherit',timeout:150000});
 const log=cp.execFileSync(out,[],{cwd:dir,encoding:'utf8',timeout:60000});
 assert.match(log,/DSP_ECHO_FEEDBACK_V043644_PASS/);
 console.log(log.trim());
}finally{fs.rmSync(dir,{recursive:true,force:true});}
