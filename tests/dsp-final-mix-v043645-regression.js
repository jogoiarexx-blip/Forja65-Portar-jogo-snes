'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-final-mix-v043645.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const runtime=project['src/runtime.hpp'];
assert.match(runtime,/Match the S-DSP's final MVOL\/EVOL path/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dsp-final-v043645-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),runtime);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
 const binary=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-I'+dir,path.join(__dirname,'fixtures','dsp_final_mix_v043645.cpp'),'-o',binary],{cwd:dir,stdio:'inherit',timeout:150000});
 const output=cp.execFileSync(binary,[],{cwd:dir,encoding:'utf8',timeout:60000});
 assert.match(output,/DSP_FINAL_MIX_V043645_PASS/);
 console.log(output.trim());
}finally{fs.rmSync(dir,{recursive:true,force:true});}
