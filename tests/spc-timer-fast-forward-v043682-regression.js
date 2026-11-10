'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'spc-timer-fast-forward-v043682.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-timer82-'));
try{
 const header=project['src/runtime.hpp'];
 assert.match(header,/v0\.4\.36\.82: advance SPC700 timer stages in O\(1\)/);
 fs.writeFileSync(path.join(temp,'runtime.hpp'),header);
 fs.writeFileSync(path.join(temp,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
 const levels=(process.env.FORJA65_TEST_LEVELS||'-O0,-O2').split(',');
 for(const level of levels){
  assert.ok(['-O0','-O1','-O2'].includes(level));
  const output=path.join(temp,process.platform==='win32'?'test.exe':'test');
  const args=['-std=c++20',level,'-I'+temp,
   path.join(__dirname,'fixtures','spc_timer_fast_forward_v043682.cpp'),'-o',output];
  cp.execFileSync(process.env.CXX||'g++',args,{cwd:temp,timeout:180000,stdio:'pipe'});
  const text=cp.execFileSync(output,[],{cwd:temp,timeout:60000,encoding:'utf8'});
  assert.match(text,/SPC_TIMER_FAST_FORWARD_V043682_PASS.*total=\d+/);
  console.log(level,text.trim());
 }
}finally{fs.rmSync(temp,{recursive:true,force:true});}
