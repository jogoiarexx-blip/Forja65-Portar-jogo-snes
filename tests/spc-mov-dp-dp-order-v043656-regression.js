'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'spc-mov-dp-dp-order-v043656.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-mov56-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),project['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
 for(const level of ['-O0','-O2']){
  const bin=path.join(dir,process.platform==='win32'?'test.exe':'test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',level,'-I'+dir,
   path.join(__dirname,'fixtures','spc_mov_dp_dp_order_v043656.cpp'),'-o',bin],
   {cwd:dir,timeout:180000,stdio:'pipe'});
  const out=cp.execFileSync(bin,[],{cwd:dir,timeout:60000,encoding:'utf8',
   env:{...process.env,FORJA65_SPC_PROFILE:'reference'}});
  assert.match(out,/SPC_MOV_DP_DP_ORDER_V043656_PASS cases=\d+/);
  console.log(level, out.trim());
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
