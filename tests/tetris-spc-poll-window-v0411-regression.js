'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'spc-poll-window-v0411.sfc');
const files=F.generateProject(rom,F.analyze(rom,512));
const header=files['src/runtime.hpp'];
for(const key of ['traceCpuReadWindow','cpuPc','lastCpuPc','masterObserved-portEvents[index].master<=1364u','apu.read(bbus-0x2140u,lastInstructionPc)']){
 if(!header.includes(key))throw Error('Missing APU poll window / CPU PC crossfeed: '+key);
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-window-v0411-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
 fs.copyFileSync(path.join(__dirname,'fixtures','tetris_spc_cpu_poll_runs_v0410.cpp'),path.join(dir,'test.cpp'));
 const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-Wall','-Wextra','-Wpedantic','-Werror','test.cpp','-o',exe],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(exe,[],{cwd:dir,stdio:'inherit'});
 console.log('FORJA65_TETRIS_APU_POLL_WINDOW_V0411_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
