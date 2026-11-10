'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'tetris-spc-semantics-v0407.sfc');
const emitted=F.generateProject(rom,F.analyze(rom,512));
const header=emitted['src/runtime.hpp'];
for(const key of ['correctedSpcSemantics','dpRead16','adcValue','sbcValue','FORJA65_SPC_SEMANTICS']){
 if(!header.includes(key))throw Error('SPC regression: missing generated feature '+key);
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-tetris-spc-semantics-'));
try {
 fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
 fs.copyFileSync(path.join(__dirname,'fixtures','tetris_spc_semantics_v0407.cpp'),path.join(dir,'test.cpp'));
 const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-Wall','-Wextra','-Wpedantic','-Werror','test.cpp','-o',exe],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(exe,[],{cwd:dir,stdio:'inherit'});
 console.log('FORJA65_TETRIS_SPC_SEMANTICS_V0407_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
