'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const F = require('../forja65-core.js');
const rom = F.loadRom(F.makeSyntheticRom(),'pixel-ownership-v0389.sfc');
const header = F.generateProject(rom,F.analyze(rom,256,[]))['src/runtime.hpp'];
for(const needle of ['PixelOwnership explainPixel(', 'bool writePixelOwnership(', 'FORJA65_CAPTURE_PIXEL_OWNERSHIP', 'pixel-ownership.csv', 'snapshot_matches_frame']) {
  assert(header.includes(needle),`missing generated runtime feature: ${needle}`);
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'forja65-pixel-ownership-'));
try {
  fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
  fs.writeFileSync(path.join(dir,'test.cpp'),String.raw`
#include "runtime.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
int main(){
 SnesRuntime hw;auto&p=hw.ppu;
 p.tm=0x10;p.brightness=15;p.obsel=0;
 for(unsigned i=1;i<128;i++)p.oam[512+i/4]|=(std::uint8_t)(1u<<((i%4)*2));
 p.oam[0]=10;p.oam[1]=10;p.oam[3]=0x30;p.vram[0]=0x80;p.cgram[258]=31;
 auto pix=p.explainPixel(10,10);
 if(!pix.obj.valid||pix.winner.source!=4||pix.winner.oamIndex!=0)return 1;
 hw.fbWidth=256;hw.fbHeight=224;hw.framebuffer=p.renderFrame(256,224);
 const auto dir=std::filesystem::current_path();
 if(!hw.writePixelOwnership(dir))return 2;
 std::ifstream in(dir/"pixel-ownership.csv");
 std::string csv((std::istreambuf_iterator<char>(in)),{});
 if(csv.find("10,10,0,16,4,16,0,obj_wins,0,1")==std::string::npos)return 3;
 std::cout<<"FORJA_PIXEL_OWNERSHIP_GENERATED_PASS\n";return 0;
}
`);
  const compile=cp.spawnSync(process.env.CXX||'c++',['-std=c++20','-O0','-g0','-I',dir,path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{cwd:dir,encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr||String(compile.error));
  const run=cp.spawnSync(path.join(dir,'test'),[],{cwd:dir,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr||run.stdout||String(run.error));
  assert.match(run.stdout,/FORJA_PIXEL_OWNERSHIP_GENERATED_PASS/);
  console.log('FORJA_PIXEL_OWNERSHIP_V0389_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
