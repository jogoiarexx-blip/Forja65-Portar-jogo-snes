'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert');
const F=require('../forja65-core');const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,64));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-hdma-rev160-'));
try{
 let runtime=files['src/runtime.hpp'];
 assert(runtime.includes('unsigned remaining=mc;\n    while(remaining){'));
 // Count actual scheduler iterations in the generated runtime, without a mock.
 runtime=runtime.replace('unsigned remaining=mc;\n    while(remaining){','unsigned remaining=mc;\n    while(remaining){++rev160Steps;');
 fs.writeFileSync(path.join(dir,'runtime.hpp'),runtime);fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
 for(const opt of ['-O0','-O2']){
  const exe=path.join(dir,'probe');
  cp.execFileSync('g++',['-std=c++20',opt,'-Wall','-Wextra','-Wpedantic','-Werror','-I'+dir,path.join(__dirname,'fixtures/hdma_raster_idle_rev160.cpp'),'-o',exe],{timeout:120000,stdio:'pipe'});
  for(const v0 of ['0','1']){
   const out=cp.execFileSync(exe,[],{cwd:dir,encoding:'utf8',timeout:120000,env:{...process.env,FORJA65_HDMA_V0_TRANSFER:v0}});
   assert.match(out,/HDMA_RASTER_REV160_PASS/);console.log(opt,'v0='+v0,out.trim());
  }
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
