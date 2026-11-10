
'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'ppu-brightness-v027.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384));
const header=generated['src/runtime.hpp'];
assert.ok(header.includes('brightnessLut()'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-ppu-lut-v027-'));
try {
  fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),generated['src/pcm_audio_output.hpp']);
  fs.copyFileSync(path.join(__dirname,'fixtures','ppu_brightness_lut_v027.cpp'),path.join(dir,'test.cpp'));
  const bin=path.join(dir,process.platform==='win32'?'test.exe':'test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O2','test.cpp','-o',bin],{cwd:dir,stdio:'inherit'});
  cp.execFileSync(bin,[],{cwd:dir,stdio:'inherit'});
  console.log('FORJA65_PPU_BRIGHTNESS_LUT_V027_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
