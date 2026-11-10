// REV160: pin the setup-only profile required by this historical counter fixture.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const F=require('../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom(),'hdma-nltr-v043661.sfc');
const files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-hdma-nltr-61-'));
try {
 fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
 const fixture=path.join(__dirname,'fixtures','hdma_nltr_manual_override_v043661.cpp');
 for(const opt of (process.env.FORJA65_TEST_LEVELS||'-O0,-O2').split(',')) {
  assert.ok(['-O0','-O1','-O2'].includes(opt));
  const exe=path.join(dir,process.platform==='win32'?'probe.exe':'probe');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,'-I'+dir,fixture,'-o',exe],{timeout:120000,cwd:dir,stdio:'pipe'});
  const result=cp.execFileSync(exe,[],{timeout:60000,cwd:dir,encoding:'utf8',env:{...process.env,FORJA65_HDMA_V0_TRANSFER:'0'}});
  assert.match(result,/HDMA_NLTR_OVERRIDE_V043661_PASS cases=280/);
  console.log(opt,result.trim());
 }
}finally {fs.rmSync(dir,{recursive:true,force:true});}
