'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require(process.env.FORJA65_SOURCE_CORE?path.resolve(process.env.FORJA65_SOURCE_CORE):'../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'irq-status-hold-v043666.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-irq-status-hold-v043666-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),project['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
 const binary=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-I'+dir,path.join(__dirname,'fixtures','irq_status_hold_v043666.cpp'),'-o',binary,...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{stdio:'inherit',timeout:150000});
 cp.execFileSync(binary,[],{stdio:'inherit',timeout:60000});
 console.log('IRQ_STATUS_HOLD_V043666_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
