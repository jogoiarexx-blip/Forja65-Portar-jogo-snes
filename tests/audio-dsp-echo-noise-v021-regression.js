"use strict";
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const rom=F.loadRom(F.makeSyntheticRom(),'dsp-echo-noise-test.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384));
const header=generated['src/runtime.hpp'];
for(const token of ['processEcho(std::vector<std::uint8_t>&ram','noiseLfsr','stepNoise()','pitchMod>>5','echoHistory[echoHistoryPos]'])assert.ok(header.includes(token),token);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-echo-pmon-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
 fs.copyFileSync(path.join(__dirname,'fixtures','audio_dsp_echo_noise_v021.cpp'),path.join(dir,'test.cpp'));
 const bin=path.join(dir,process.platform==='win32'?'echo-test.exe':'echo-test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','test.cpp','-o',bin],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(bin,[],{cwd:dir,stdio:'inherit'});
 console.log('FORJA65_DSP_ECHO_NOISE_PMON_V021_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
