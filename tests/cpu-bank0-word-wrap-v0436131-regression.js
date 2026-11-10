'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const core=process.env.FORJA65_TEST_CORE||path.join(__dirname,'..','forja65-core.js');
const F=require(core);const rom=F.loadRom(F.makeSyntheticRom(),'rev131-bank0.sfc');const output=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev131-bank0-'));
try{
 for(const file of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(dir,file),output['src/'+file]);
 for(const opt of ['-O0','-O2']){
   const exe=path.join(dir,'cpu-bank0-word-wrap');
   const args=['-std=c++20',opt,'-I'+dir];
   if(!process.env.FORJA65_TEST_BASELINE)args.push('-DFORJA_REV131=1');
   args.push(path.join(__dirname,'cpu-bank0-word-wrap-v0436131.cpp'),'-o',exe);
   cp.execFileSync(process.env.CXX||'g++',args,{cwd:dir,timeout:180000});
   const r=cp.spawnSync(exe,[],{cwd:dir,encoding:'utf8',timeout:100000});
   const m=/CPU_BANK0_WORD_WRAP_REV131 pass=(\d+) fail=(\d+) total=(\d+)/.exec(r.stdout||'');
   assert.ok(m,'probe output missing '+r.stderr);
   console.log(opt,m[0]);
   if(!process.env.FORJA65_SCORE_ONLY){assert.equal(+m[2],0,'bank0 word high-byte address differs from reference');assert.equal(r.status,0);}
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
