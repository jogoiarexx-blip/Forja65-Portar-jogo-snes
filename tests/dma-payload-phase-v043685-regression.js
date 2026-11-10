'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require(path.resolve(process.env.FORJA65_CORE_OVERRIDE||process.argv[2]||path.join(__dirname,'../forja65-core.js')));
const rom=F.loadRom(F.makeSyntheticRom(),'dma-wram-v043685.sfc');
const files=F.generateProject(rom,F.analyze(rom,384));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dma-wram-v043685-'));
try{
 for(const [name,data] of Object.entries(files))if(name.startsWith('src/')&&name.endsWith('.hpp'))fs.writeFileSync(path.join(dir,path.basename(name)),data);
 fs.copyFileSync(path.join(__dirname,'fixtures/dma_payload_phase_v043685.cpp'),path.join(dir,'test.cpp'));
 const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra','-Wpedantic','-Werror','test.cpp','-o',exe,...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{cwd:dir,stdio:'inherit'});
 let failed=false;
 for(const mode of ['forward','reverse']){
  const run=cp.spawnSync(exe,[mode],{cwd:dir,encoding:'utf8'});
  process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');
  if(run.error||run.status!==0)failed=true;
 }
 if(failed)throw new Error('DMA payload phase regression failed');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
