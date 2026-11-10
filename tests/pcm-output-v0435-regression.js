"use strict";
// End-to-end native generator regression: test the header emitted by Forja65,
// the standalone source and WinMM-specific logic without a Windows device.
const F=require('../forja65-core.js');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'pcm-v0435.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384));
const header=generated['src/pcm_audio_output.hpp'];
assert.equal(header,fs.readFileSync(path.join(__dirname,'../native/pcm_audio_output.hpp'),'utf8'));
assert.ok(generated['src/runtime.hpp'].includes('syncLive'));
assert.ok(generated['src/runtime.hpp'].includes('bufferWaitMs'));
assert.ok(generated['src/runtime.hpp'].includes('pcm_buffer_wait_ms'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-pcm-v0435-'));
try{
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),header);
 for(const [fixture,bin,opts] of [
  ['pcm_output_v0435.cpp','pcm-output',[]],
  ['pcm_output_winmm_mock_v0435.cpp','pcm-winmm-mock',['-D_WIN32','-I'+path.join(__dirname,'fixtures','winmm_v0435')]],
  ['pcm_output_48k_winmm_mock_v0435.cpp','pcm-48k-winmm-mock',['-D_WIN32','-I'+path.join(__dirname,'fixtures','winmm_v0435')]]
 ]){
  const output=path.join(dir,bin);
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-Wall','-Wextra','-Werror','-O1','-I'+dir,...opts,path.join(__dirname,'fixtures',fixture),'-o',output,...(process.platform==='win32'&&!opts.length?['-lwinmm']:[])],{cwd:dir,stdio:'inherit'});
  cp.execFileSync(output,[],{cwd:dir,stdio:'inherit'});
 }
 console.log('FORJA65_PCM_V0435_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
