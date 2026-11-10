'use strict';
const fs=require('node:fs'), os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const F=require('../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom(),'cpu-io-openbus-v0436122.sfc');
const files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-io-openbus-122-'));
try {
 fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
 const fixture=path.join(__dirname,'fixtures','cpu_io_openbus_v0436122.cpp');
 for(const opt of (process.env.FORJA65_TEST_LEVELS||'-O0,-O2').split(',')) {
  assert.ok(['-O0','-O1','-O2'].includes(opt));
  const exe=path.join(dir,process.platform==='win32'?'probe.exe':'probe');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,'-I'+dir,fixture,'-o',exe],{timeout:120000,cwd:dir,stdio:'pipe'});
  const result=cp.execFileSync(exe,[],{timeout:60000,cwd:dir,encoding:'utf8'});
  assert.match(result,/CPU_IO_OPENBUS_V0436122_PASS checks=613/);
  console.log(opt,result.trim());
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
