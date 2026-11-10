'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'spc-f3-documented-cycle-v043655.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-f3-cycle55-'));
try {
 fs.writeFileSync(path.join(dir,'runtime.hpp'),project['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
 const bin=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-I'+dir,
   path.join(__dirname,'fixtures','spc_f3_documented_cycle_v043655.cpp'),'-o',bin],{cwd:dir,timeout:150000,stdio:'pipe'});
 const env={...process.env,FORJA65_SPC_PROFILE:'reference',FORJA65_DSP_CLOCK:'fractional',
   FORJA65_APU_DSP_INTERLEAVE:'1',FORJA65_SPC_F3_BUS_TRACE:'1'};
 const out=cp.execFileSync(bin,[],{cwd:dir,timeout:60000,encoding:'utf8',env});
 assert.match(out,/SPC_F3_DOCUMENTED_CYCLE_V043655_PASS cases=\d+/);
 const csv=fs.readFileSync(path.join(dir,'spc_f3_annotated55.csv'),'utf8');
 assert.match(csv,/documented_write_cycle,timing_source/);
 console.log(out.trim());
}finally {fs.rmSync(dir,{recursive:true,force:true});}
