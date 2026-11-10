 'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'spc-poll-runs-v0410.sfc');
const files=F.generateProject(rom,F.analyze(rom,512));
const header=files['src/runtime.hpp'];
for(const key of ['lastCpuQIndex','last_master_cycles','polls','++portEvents[index].polls']){
 if(!header.includes(key))throw Error('Missing generated CPU poll run metadata: '+key);
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-poll-v0410-'));
try {
 fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
 fs.copyFileSync(path.join(__dirname,'fixtures','tetris_spc_cpu_poll_runs_v0410.cpp'),path.join(dir,'test.cpp'));
 const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-Wall','-Wextra','-Wpedantic','-Werror','test.cpp','-o',exe],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(exe,[],{cwd:dir,stdio:'inherit'});
 console.log('FORJA65_TETRIS_SPC_CPU_POLL_RUNS_V0410_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
