'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'tetris-spc-ipl-v0408.sfc');
const generated=F.generateProject(rom,F.analyze(rom,512));
const header=generated['src/runtime.hpp'];
for(const key of ['ntscSpcClock','savePortTrace','spcExecutedCycles','FORJA65_APU_IPL_TRACE','21477272']) {
 if(!header.includes(key))throw Error('SPC IPL crossfeed: missing '+key);
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-ipl-v0408-'));
try {
 fs.writeFileSync(path.join(tmp,'runtime.hpp'),header);
 fs.copyFileSync(path.join(__dirname,'fixtures','tetris_spc_ipl_v0408.cpp'),path.join(tmp,'test.cpp'));
 const exe=path.join(tmp,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-Wall','-Wextra','-Wpedantic','-Werror','test.cpp','-o',exe],{cwd:tmp,stdio:'inherit'});
 cp.execFileSync(exe,[],{cwd:tmp,stdio:'inherit'});
 console.log('FORJA65_TETRIS_SPC_IPL_V0408_PASS');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
