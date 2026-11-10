"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'vblank.sfc');
const files=F.generateProject(rom,F.analyze(rom,256,[]));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-oam-reload-'));
try{
 for(const name of ['runtime.hpp','pcm_audio_output.hpp']) fs.writeFileSync(path.join(dir,name),files['src/'+name]);
 const fixture=path.join(__dirname,'fixtures','oam_vblank_reload_v0387.cpp');
 const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-I'+dir,fixture,'-o',exe],{stdio:'pipe'});
 const result=cp.execFileSync(exe,[],{cwd:dir,encoding:'utf8'});
 assert.match(result,/OAM_VBLANK_RELOAD_V0387_PASS cases=8/);
 console.log(result.trim());
}finally{fs.rmSync(dir,{recursive:true,force:true});}
