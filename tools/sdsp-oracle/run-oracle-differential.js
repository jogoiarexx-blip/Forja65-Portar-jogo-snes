#!/usr/bin/env node
'use strict';
// Re-validates Forja65's S-DSP pipeline against blargg's SPC_DSP as shipped in Snes9x.
// The oracle source is downloaded at run time into a temporary folder (LGPL-2.1, never copied
// into Forja65). Requires git and a C++20 compiler (CXX, default g++).
// Usage: node tools/sdsp-oracle/run-oracle-differential.js [seeds=24] [samples=4000] [--write-golden]
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const SNES9X_COMMIT='1bcc369e89f08243e0a462882fb1f3e42e51de3a';
const seeds=process.argv[2]||'24',samples=process.argv[3]||'4000';
const root=path.join(__dirname,'..','..');const work=fs.mkdtempSync(path.join(os.tmpdir(),'forja-sdsp-oracle-'));
const run=(cmd,args,opt={})=>cp.execFileSync(cmd,args,{stdio:['ignore','pipe','inherit'],encoding:'utf8',...opt});
try{
  run('git',['clone','--filter=blob:none','--no-checkout','https://github.com/snes9xgit/snes9x.git',path.join(work,'snes9x')]);
  run('git',['-C',path.join(work,'snes9x'),'checkout',SNES9X_COMMIT,'--','apu/bapu/dsp']);
  const dsp=path.join(work,'snes9x','apu','bapu','dsp');
  const cppPath=path.join(dsp,'SPC_DSP.cpp');fs.writeFileSync(cppPath,fs.readFileSync(cppPath,'utf8').replace('"../../../snes9x.h"','"snes9x_stub.h"'));
  for(const f of ['oracle_main.cpp','snes9x_stub.h'])fs.copyFileSync(path.join(__dirname,f),path.join(dsp,f));
  fs.copyFileSync(path.join(root,'tests','sdsp_scenarios_v0436132.hpp'),path.join(dsp,'sdsp_scenarios_v0436132.hpp'));
  const exe=path.join(work,process.platform==='win32'?'oracle.exe':'oracle');
  run(process.env.CXX||'g++',['-std=c++20','-O2','-w','-I'+dsp,path.join(dsp,'oracle_main.cpp'),cppPath,'-o',exe]);
  const golden=run(exe,[seeds,samples]);const goldenPath=path.join(work,'golden.txt');fs.writeFileSync(goldenPath,golden);
  // Forja65 side
  const F=require(path.join(root,'forja65-core.js'));const rom=F.loadRom(F.makeSyntheticRom(),'oracle.sfc'),p=F.generateProject(rom,F.analyze(rom,32));
  for(const f of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(work,f),p['src/'+f]);
  for(const f of ['sdsp-pipeline-v0436132.cpp','sdsp_scenarios_v0436132.hpp'])fs.copyFileSync(path.join(root,'tests',f),path.join(work,f));
  const fexe=path.join(work,process.platform==='win32'?'forja.exe':'forja');
  run(process.env.CXX||'g++',['-std=c++20','-O2','-I'+work,path.join(work,'sdsp-pipeline-v0436132.cpp'),'-o',fexe]);
  const r=cp.spawnSync(fexe,[goldenPath],{encoding:'utf8'});process.stdout.write(r.stdout);
  if(process.argv.includes('--write-golden'))fs.writeFileSync(path.join(root,'tests','fixtures','sdsp-rev132-golden.txt'),golden);
  process.exitCode=r.status;
}finally{fs.rmSync(work,{recursive:true,force:true});}
