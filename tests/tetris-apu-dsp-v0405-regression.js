'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'tetris-v0405-apu-test.sfc');
const emitted=F.generateProject(rom,F.analyze(rom,512));
const src=emitted['src/runtime.hpp'];
// The compiled fixture checks DSPADDR inhibition, FLG mute while decoding
// continues, ENDX, note restart, looping, and soft reset through the APU API.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-tetris-apu-405-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),src);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),emitted['src/pcm_audio_output.hpp']);
 fs.copyFileSync(path.join(__dirname,'fixtures','tetris_apu_dsp_v0405.cpp'),path.join(dir,'test.cpp'));
 const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','test.cpp','-o',exe],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(exe,[],{cwd:dir,stdio:'inherit'});
 console.log('FORJA65_TETRIS_APU_DSP_V0405_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
