// Verify the newer scanline-sliver renderer via compiled parity, not removed cache locals.
'use strict';
// Protect the contract the game port consumes, not only the Forja65 source text.
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'obj-qa.sfc');
const emitted=F.generateProject(rom,F.analyze(rom,512));
const runtime=emitted['src/runtime.hpp'];
// The compiled fixture asserts bank/gap addressing, rotation, OAM order,
// Y-wrap, scalar/row parity, vblank reload, and DMA results.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-tetris-obj-'));
try{
  fs.mkdirSync(path.join(dir,'assets'));
  fs.writeFileSync(path.join(dir,'runtime.hpp'),runtime);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),emitted['src/pcm_audio_output.hpp']);
  fs.writeFileSync(path.join(dir,'assets','cart-data.bin'),emitted['assets/cart-data.bin']);
  fs.copyFileSync(path.join(__dirname,'fixtures','tetris_sprite_crossfeed_v0398.cpp'),path.join(dir,'test.cpp'));
  const executable=path.join(dir,process.platform==='win32'?'test.exe':'test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra','-pedantic','-Werror','test.cpp','-o',executable],{cwd:dir,stdio:'inherit'});
  cp.execFileSync(executable,[],{cwd:dir,stdio:'inherit'});
  console.log('FORJA65_TETRIS_OBJ_CROSSFEED_GENERATOR_PASS');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
