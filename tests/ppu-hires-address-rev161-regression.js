'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require(process.env.FORJA65_TEST_CORE||'../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,64));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-hires-rev161-'));
try{
 for(const f of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(dir,f),files['src/'+f]);
 fs.copyFileSync(path.join(__dirname,'fixtures/ppu_hires_address_rev161.cpp'),path.join(dir,'probe.cpp'));
 let failed=false;for(const opt of ['-O0','-O2']){
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,'-Wall','-Wextra','-Werror','-I'+dir,path.join(dir,'probe.cpp'),'-o',path.join(dir,'probe')],{stdio:'inherit'});
  const r=cp.spawnSync(path.join(dir,'probe'),[],{stdio:'inherit'});
  if(r.status!==0){failed=true;if(!process.env.FORJA65_SCORE_ONLY)throw new Error('hires pixel regression '+opt);}
 }
 if(failed)process.exitCode=1;
}finally{fs.rmSync(dir,{recursive:true,force:true});}
