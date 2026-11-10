'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom(),'rev127-hardware.sfc');
const files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev127-hw-'));
try{
 for(const file of ['runtime.hpp','pcm_audio_output.hpp']) fs.writeFileSync(path.join(dir,file),files['src/'+file]);
 for(const opt of ['-O0','-O2']){
  const exe=path.join(dir,'hardware-probe');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,'-I'+dir,path.join(__dirname,'hardware-bus-sram-v0436127.cpp'),'-o',exe],{cwd:dir,timeout:180000});
  const result=cp.execFileSync(exe,['--strict'],{cwd:dir,timeout:60000,encoding:'utf8'});
  if(!/fail=0\b/.test(result))throw Error(result);
  console.log(opt,result.trim());
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
