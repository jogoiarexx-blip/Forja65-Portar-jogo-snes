'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const provenance=require('./fixtures/ppu_obj_direct_recount_v67.provenance.json');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'fixtures','ppu_obj_direct_recount_v67.hpp'))).digest('hex'),provenance.fixture_sha256);
function run(source,pinned=false){
 const F=require(source);
 const rom=F.loadRom(F.makeSyntheticRom(),'ppu-obj-hblank-compare-v043670.sfc');
 const files=F.generateProject(rom,F.analyze(rom,128));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-obj-compare-'));
 try {
  fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
  const exe=path.join(dir,process.platform==='win32'?'probe.exe':'probe');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0',...(pinned?['-DFORJA65_PINNED_RECOUNT_ORACLE=1']:[]),'-I'+dir,path.join(__dirname,'fixtures','ppu_obj_hblank_retroactive_comparison_v043670.cpp'),'-o',exe],{timeout:120000,stdio:'pipe'});
  return cp.execFileSync(exe,[],{encoding:'utf8',timeout:60000}).trim();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const oldSource=process.env.FORJA65_OLD_CORE;
const current=path.resolve(__dirname,'../forja65-core.js');
if(oldSource){
 const old=run(path.resolve(oldSource)),updated=run(current);
 assert.match(old,/MID_FETCH_TIME_OVER=0/);assert.match(updated,/MID_FETCH_TIME_OVER=1/);
 console.log('PPU_OBJ_HBLANK_COMPARISON_PASS external-core old='+old+' new='+updated);
}else{
 // Actual v69 source is unavailable. Compare current timing to the separately
 // pinned v67 recount algorithm; this is a model differential, not a v69 rerun.
 const result=run(current,true);
 assert.match(result,/OLD_MODEL_MID_FETCH_TIME_OVER=0 OLD_SLIVERS=33 NEW_MID_FETCH_TIME_OVER=1 CONTROL_BOTH_OVERFLOW=1/);
 console.log('PPU_OBJ_HBLANK_COMPARISON_PASS baseline=v67-pinned-direct-recount '+result);
}
