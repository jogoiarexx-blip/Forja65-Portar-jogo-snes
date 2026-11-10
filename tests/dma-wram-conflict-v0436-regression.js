'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'dma-wram-v0436.sfc');
const files=F.generateProject(rom,F.analyze(rom,384));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dma-wram-v0436-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
 fs.copyFileSync(path.join(__dirname,'fixtures/dma_wram_conflict_v0436.cpp'),path.join(dir,'test.cpp'));
 const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra','-Wpedantic','-Werror','test.cpp','-o',exe,...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{cwd:dir,stdio:'inherit'});
 let failed=false;
 for(const mode of ['forward','reverse']){
  const run=cp.spawnSync(exe,[mode],{cwd:dir,encoding:'utf8'});
  process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');
  if(run.error||run.status!==0)failed=true;
 }
 if(failed)throw new Error('DMA/WRAM behavior regression failed');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
