'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dsp-echo-baseline46-'));
function probe(name,core){
  const F=require(core);
  const rom=F.loadRom(F.makeSyntheticRom(),name+'.sfc');
  const proj=F.generateProject(rom,F.analyze(rom,128));
  const sub=path.join(dir,name);fs.mkdirSync(sub);
  fs.writeFileSync(path.join(sub,'runtime.hpp'),proj['src/runtime.hpp']);
  fs.writeFileSync(path.join(sub,'pcm_audio_output.hpp'),proj['src/pcm_audio_output.hpp']);
  const exe=path.join(sub,'run');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-I'+sub,path.join(__dirname,'fixtures','dsp_echo_delay_baseline_probe_v043646.cpp'),'-o',exe],{timeout:180000});
  return cp.execFileSync(exe,[],{encoding:'utf8',timeout:20000});
}
try{
 const after=probe('after',path.resolve(__dirname,'../forja65-core.js'));
 assert.match(after,/ECHO_OFFSET_AFTER_EDL_WRITE=4/);
 assert.match(after,/ECHO_OFFSET_AFTER_ESA_WRITE=4/);
 if(process.env.FORJA_BASELINE_CORE){
   const before=probe('before',path.resolve(process.env.FORJA_BASELINE_CORE));
   assert.match(before,/ECHO_OFFSET_AFTER_EDL_WRITE=0/);
   assert.match(before,/ECHO_OFFSET_AFTER_ESA_WRITE=0/);
   console.log('DSP_ECHO_DELAY_BASELINE_DIFF_V043646_PASS old=0 new=4');
 }else{
   console.log('DSP_ECHO_DELAY_CURRENT_V043646_PASS new=4; optional old comparison: set FORJA_BASELINE_CORE');
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
