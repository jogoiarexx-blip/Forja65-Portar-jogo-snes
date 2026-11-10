'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'spc-f3-instruction-boundary-v043652.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-f3-v043652-'));
try {
 fs.writeFileSync(path.join(dir,'runtime.hpp'),project['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
 const bin=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-I'+dir,path.join(__dirname,'fixtures','spc_f3_instruction_boundary_v043652.cpp'),'-o',bin],{cwd:dir,stdio:'pipe',timeout:150000});
 const baseEnv={...process.env,FORJA65_SPC_PROFILE:'reference',FORJA65_DSP_CLOCK:'fractional',FORJA65_APU_DSP_INTERLEAVE:'1',FORJA65_SPC_F3_ECHO_BOUNDARY:'1'};
 const out=cp.execFileSync(bin,[],{cwd:dir,encoding:'utf8',timeout:60000,env:baseEnv});
 assert.match(out,/SPC_F3_INSTRUCTION_BOUNDARY_V043652_PASS cases=\d+/);
 console.log(out.trim());
}finally{fs.rmSync(dir,{recursive:true,force:true});}
