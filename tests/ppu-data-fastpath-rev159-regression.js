'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const F=require('../forja65-core');const r=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(r,F.analyze(r,96));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-ppu-rev159-'));
try{
 for(const n of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(dir,n),files['src/'+n]);
 for(const opt of (process.env.FORJA65_TEST_LEVELS||'-O0,-O2').split(',')){
  const exe=path.join(dir,'probe');
  cp.execFileSync('g++',['-std=c++20',opt,'-Wall','-Wextra','-Wpedantic','-Werror','-I'+dir,path.join(__dirname,'fixtures/ppu_data_fastpath_rev159.cpp'),'-o',exe],{timeout:120000,stdio:'pipe'});
  const out=cp.execFileSync(exe,[],{timeout:120000,encoding:'utf8',cwd:dir});
  assert.match(out,/PPU_DATA_FASTPATH_REV159_PASS/);console.log(opt,out.trim());
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
