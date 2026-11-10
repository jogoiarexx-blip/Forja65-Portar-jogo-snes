'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'spc-register-edges-v0413.sfc');
const files=F.generateProject(rom,F.analyze(rom,512));
const header=files['src/runtime.hpp'];
for(const key of ['case 0xF2: return s.spc.dspAddr;','enabled && !s.spc.timersOn[i]'])if(!header.includes(key))throw Error('Missing SPC hardware fix: '+key);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-register-edges-v0413-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
 fs.copyFileSync(path.join(__dirname,'fixtures','tetris_spc_register_edges_v0413.cpp'),path.join(dir,'test.cpp'));
 const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-w','test.cpp','-o',exe],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(exe,[],{cwd:dir,stdio:'inherit'});
 console.log('FORJA65_SPC_REGISTER_EDGES_V0413_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
