'use strict';
// Integrate the emitted Forja65 runtime, not a mocked reimplementation.
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'obj-limits-qa.sfc');
const emitted=F.generateProject(rom,F.analyze(rom,512));
const runtime=emitted['src/runtime.hpp'];
for(const contract of ['evaluateSpriteSlivers(int sy)','out.rangeOver=true','out.timeOver=true',
    'objRangeTimeFlags|=0x40u','objRangeTimeFlags|=0x80u','ppu.objRangeTimeFlags=0']){
  if(!runtime.includes(contract)) throw new Error('Generator lost scanline OBJ rule: '+contract);
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-obj-limits-'));
try {
  fs.mkdirSync(path.join(dir,'assets'));
  fs.writeFileSync(path.join(dir,'runtime.hpp'),runtime);
  fs.writeFileSync(path.join(dir,'assets','cart-data.bin'),emitted['assets/cart-data.bin']);
  fs.copyFileSync(path.join(__dirname,'fixtures','tetris_sprite_limits_v0399.cpp'),path.join(dir,'test.cpp'));
  const executable=path.join(dir,process.platform==='win32'?'test.exe':'test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra','-pedantic','-Werror','test.cpp','-o',executable],{cwd:dir,stdio:'inherit'});
  cp.execFileSync(executable,[],{cwd:dir,stdio:'inherit'});
  console.log('FORJA65_TETRIS_OBJ_LIMITS_GENERATOR_PASS');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
