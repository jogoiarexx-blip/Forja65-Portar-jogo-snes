'use strict';
const F=require(require('node:path').resolve(process.env.FORJA65_CORE_OVERRIDE||require('node:path').join(__dirname,'../forja65-core.js')));
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'rev215-dma-clock-test.sfc');
const files=F.generateProject(rom,F.analyze(rom,256));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev215-dma-refresh-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
 fs.copyFileSync(path.join(__dirname,'fixtures/rev215_dma_refresh_alignment.cpp'),path.join(dir,'test.cpp'));
 const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra','-Wpedantic','-Werror','test.cpp','-o',exe,...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{cwd:dir,stdio:'inherit'});
 const run=cp.spawnSync(exe,[],{cwd:dir,encoding:'utf8',env:{...process.env,FORJA65_DMA_SYNC:''}});
 process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');
 if(run.error||run.status!==0)throw new Error('Modern DMA alignment regression failed');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
