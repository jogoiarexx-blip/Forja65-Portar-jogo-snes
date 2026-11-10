'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-timestamped-echo-gate-v043651.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dsp-flg-v043651-'));
try {
 fs.writeFileSync(path.join(dir,'runtime.hpp'),project['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
 const bin=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-I'+dir,path.join(__dirname,'fixtures','dsp_timestamped_echo_gate_v043651.cpp'),'-o',bin],{cwd:dir,stdio:'pipe',timeout:150000});
 const out=cp.execFileSync(bin,[],{cwd:dir,encoding:'utf8',timeout:60000});
 assert.match(out,/DSP_TIMESTAMPED_ECHO_GATE_V043651_PASS cases=\d+/);
 console.log(out.trim());
}finally{fs.rmSync(dir,{recursive:true,force:true});}
