'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const rom=F.loadRom(F.makeSyntheticRom(),'transport-smoke-v026.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384));
const header=generated['src/runtime.hpp'];

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-audio-key-v024-'));
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),generated['src/pcm_audio_output.hpp']);
  fs.writeFileSync(path.join(dir,'test.cpp'),generated['tests/audio_dsp_transport_smoke.cpp']);
  const bin=path.join(dir,process.platform==='win32'?'key-test.exe':'key-test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','test.cpp','-o',bin],{cwd:dir,stdio:'inherit'});
  cp.execFileSync(bin,[],{cwd:dir,stdio:'inherit'});
  console.log('FORJA65_TRANSPORT_SMOKE_V026_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
