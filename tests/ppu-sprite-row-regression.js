'use strict';
// v0.4.36.1: replace the pre-32/34-OBJ scalar reference with a live scalar
// vs row-compositor test. The historical renderer intentionally disagrees on
// dropped OBJ tiles, so pixel-equality to that renderer is not a valid test.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const C=require('../forja65-core');
const rom=C.loadRom(C.makeSyntheticRom());
const files=C.generateProject(rom,C.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-sprite-row-v04361-'));
let h=files['src/runtime.hpp'].replace('struct PpuState {','struct PpuState { mutable unsigned testSpriteVisits{};');
const original='for(unsigned si=0;si<128u;si++){';
if(!h.includes(original))throw new Error('PPU OBJ evaluator no longer matches test instrumentation');
h=h.replace(original,original+'testSpriteVisits++;');
const cpp=String.raw`#include "runtime.hpp"
#include <cassert>
#include <iostream>
#include <random>
int main(){
 PpuState init;init.brightness=15;init.tm=0x10;std::vector<std::uint32_t> pixels;
 init.renderOutputSegment(pixels,32,0,256);
 if(init.testSpriteVisits!=128){std::cerr<<"OBJ row scan count: "<<init.testSpriteVisits<<"\n";return 1;}
 unsigned samples=0;
 std::mt19937 rng(0x65c816);
 for(unsigned n=0;n<64;++n){
  PpuState p;p.tm=0x10;p.brightness=15;p.obsel=(std::uint8_t)((n%8)*32);p.mosaic=(std::uint8_t)(n*3);
  p.regs[3]=(std::uint8_t)((n&1)?0x80:0);p.oamAddr=(std::uint16_t)(n*2);
  for(auto& q:p.vram)q=(std::uint8_t)rng();
  for(auto& q:p.cgram)q=(std::uint8_t)rng();
  for(auto& q:p.oam)q=(std::uint8_t)rng();
  for(int y:{0,7,31,111,223}){
   auto row=p.buildSpriteRow(y);
   for(int x=0;x<256;++x){
    auto q=p.sampleSprites(x,y),r=row[x];
    assert(q.valid==r.valid);
    if(q.valid){assert(q.oamIndex==r.oamIndex&&q.priority==r.priority&&q.c15==r.c15&&q.objPal==r.objPal);}
    ++samples;
   }
  }
 }
 // Regression for midline OAM/VRAM/CGRAM changes: no cross-segment cache.
 PpuState p;p.tm=0x10;p.brightness=15;
 for(unsigned i=0;i<128;i++)p.oam[i*4+1]=128;
 p.oam[0]=100;p.oam[1]=0;p.vram[0]=0x80;p.cgram[258]=31;
 std::vector<std::uint32_t> frame;p.renderOutputSegment(frame,0,0,64);
 const auto before=frame[32];p.oam[0]=80;p.cgram[258]=0xe0;p.cgram[259]=3;
 p.renderOutputSegment(frame,0,64,256);
 assert(frame[32]==before && frame[80]==p.rgba15(p.finalMain15(80,0,false)));
 std::cout<<"PPU_SPRITE_ROW_V04361_PASS obj_visits=128 row_scalar_samples="<<samples<<" midline=live\n";
}`;
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),h);fs.writeFileSync(path.join(dir,'probe.cpp'),cpp);
 const cc=cp.spawnSync(process.env.CXX||'c++',['-std=c++20','-O2','-g0','probe.cpp','-o','probe'],{cwd:dir,encoding:'utf8'});
 if(cc.status!==0)throw new Error(cc.stderr||String(cc.error));
 const r=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,encoding:'utf8'});
 if(r.status!==0)throw new Error(r.stderr||r.stdout||String(r.error));
 console.log(r.stdout.trim());
}finally{fs.rmSync(dir,{recursive:true,force:true});}
