'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-echo-flg-dual-gate-v043650.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dsp-flg-v043650-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),project['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
 const binary=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-I'+dir,path.join(__dirname,'fixtures','dsp_echo_flg_dual_gate_v043650.cpp'),'-o',binary],{cwd:dir,stdio:'pipe',timeout:150000});
 const out=cp.execFileSync(binary,[],{cwd:dir,encoding:'utf8',timeout:60000});
 assert.match(out,/DSP_ECHO_FLG_DUAL_GATE_V043650_PASS cases=1028/);
 console.log(out.trim());
}finally{fs.rmSync(dir,{recursive:true,force:true});}
