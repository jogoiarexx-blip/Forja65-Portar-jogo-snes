'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'oam-vblank-v0387.sfc');
const source=F.generateProject(rom,F.analyze(rom,256,[]))['src/runtime.hpp'];
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-vblank-'));
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),source);
  fs.writeFileSync(path.join(dir,'test.cpp'),String.raw`
#include "runtime.hpp"
#include <iostream>
int main(){
 SnesRuntime hw;
 hw.ppu.write(0x2102,0x14);hw.ppu.write(0x2103,0);
 hw.ppu.oamAddr=123;hw.ppu.oamFlip=true;
 hw.beginVblank();
 if(hw.ppu.oamAddr!=0x14||hw.ppu.oamFlip)return 2;
 hw.ppu.write(0x2100,0x80);hw.ppu.oamAddr=0xF9;
 hw.beginVblank();
 if(hw.ppu.oamAddr!=0xF9)return 3;
 std::cout<<"OAM_VBLANK_RUNTIME_V0387_PASS\n";
}
`);
  const c=cp.spawnSync(process.env.CXX||'c++',['-std=c++20','-O0','-g0','-I',dir,path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{cwd:dir,encoding:'utf8'});
  assert.equal(c.status,0,c.stderr||String(c.error));
  const r=cp.spawnSync(path.join(dir,'test'),[],{cwd:dir,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr||r.stdout||String(r.error));
  assert.match(r.stdout,/OAM_VBLANK_RUNTIME_V0387_PASS/);
  console.log('FORJA_OAM_VBLANK_RUNTIME_V0387_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
