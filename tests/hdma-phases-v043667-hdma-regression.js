// REV160: this historical fixture checks setup-only timing; current/default V=0 behavior has a separate regression.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require(process.env.FORJA65_CORE_OVERRIDE||'../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-v043666-video-'));
try{
 for(const name of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(dir,name),files['src/'+name]);
 fs.copyFileSync(path.join(__dirname,'fixtures/hdma_phases_v043667-hdma.cpp'),path.join(dir,'probe.cpp'));
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O2','-Wall','-Wextra','-Wpedantic','-Werror','probe.cpp','-o','probe',...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{cwd:dir,stdio:'inherit'});
 for(const group of ['hdma']){const result=cp.spawnSync(path.join(dir,'probe'),[group],{cwd:dir,encoding:'utf8',env:{...process.env,FORJA65_HDMA_V0_TRANSFER:'0'}});process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(result.status!==0)process.exitCode=1;}
}finally{fs.rmSync(dir,{recursive:true,force:true});}
