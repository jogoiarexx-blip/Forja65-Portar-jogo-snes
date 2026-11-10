'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require(process.env.FORJA65_CORE_OVERRIDE||'../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'dma-hdma-indirect-das.sfc');
const files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-v0436124-dma-hdma-'));
try{
 for(const n of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(dir,n),files['src/'+n]);
 fs.copyFileSync(path.join(__dirname,'fixtures/dma_hdma_indirect_das_v0436124.cpp'),path.join(dir,'probe.cpp'));
 for(const optimization of ['-O0','-O2']){
  const exe=path.join(dir,'probe'+optimization);
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',optimization,'-Wall','-Wextra','-Wpedantic','-Werror','probe.cpp','-o',exe,...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{cwd:dir,stdio:'inherit',timeout:90000});
  const run=cp.spawnSync(exe,[],{cwd:dir,encoding:'utf8',timeout:90000});
  process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');
  if(run.error||run.status!==0)throw new Error('indirect DMA/HDMA DAS collision regression '+optimization);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
