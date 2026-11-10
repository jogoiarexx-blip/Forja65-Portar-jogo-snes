'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require(process.env.FORJA65_SOURCE_CORE?path.resolve(process.env.FORJA65_SOURCE_CORE):'../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-pmon-range-v043685.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dsp-pmon-range-v043685-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),project['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
 const binary=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-I'+dir,path.join(__dirname,'fixtures','dsp_pmon_range_v043685.cpp'),'-o',binary,...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{stdio:'inherit',timeout:150000});
 fs.writeFileSync(path.join(dir,'cart.sfc'),Buffer.from(F.makeSyntheticRom()));
 cp.execFileSync(binary,[path.join(dir,'cart.sfc')],{cwd:dir,stdio:'inherit',timeout:60000,env:{...process.env,FORJA65_AUDIO_MODE:'native'}});
 console.log('DSP_PMON_RANGE_V043685_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
