'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const rom=F.loadRom(F.makeSyntheticRom(),'audio-enhanced-test.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384));
const header=generated['src/runtime.hpp'];
for(const token of ['stepEnvelope(unsigned i)','voice[i].releasing=true','envPeriods[32]','v.decoded[std::min(15u,index+1u)]','BRR_ADSR_GAUSS_OR_LINEAR_8VOICE'])assert.ok(header.includes(token),token);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-audio-dsp-v020-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
 fs.copyFileSync(path.join(__dirname,'fixtures','audio_dsp_enhanced_v020.cpp'),path.join(dir,'test.cpp'));
 const bin=path.join(dir,process.platform==='win32'?'audio-test.exe':'audio-test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','test.cpp','-o',bin],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(bin,[],{cwd:dir,stdio:'inherit'});
 console.log('FORJA65_DSP_ENHANCED_V020_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
