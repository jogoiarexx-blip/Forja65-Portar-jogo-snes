#include "runtime.hpp"
#include <chrono>
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <vector>

static void check(bool q, const char*msg){if(!q)throw std::runtime_error(msg);}
static std::uint32_t rnd(std::uint32_t&s){s=s*1664525u+1013904223u;return s;}
static PpuState makePpu(unsigned mode, unsigned scenario){
  PpuState p;
  std::uint32_t seed=0x65C81642u+mode*997u+scenario*101u;
  for(auto&v:p.vram)v=(std::uint8_t)(rnd(seed)>>24);
  for(auto&v:p.cgram)v=(std::uint8_t)(rnd(seed)>>24);
  for(auto&v:p.oam)v=(std::uint8_t)(rnd(seed)>>24);
  p.write(0x2100,0x0F);
  p.bgmode=(std::uint8_t)(mode|((scenario&1u)?0x90u:0u));
  p.obsel=(std::uint8_t)(scenario*17u);
  p.mosaic=(std::uint8_t)((scenario&1u)?0x33:0);
  p.tm=(std::uint8_t)((scenario==1)?0x1Fu:0x17u);
  p.ts=(std::uint8_t)((scenario==2)?0x13u:0x10u);
  p.cgwsel=(std::uint8_t)((scenario==2)?0x02:0);
  p.cgadsub=(std::uint8_t)((scenario==2)?0x7F:0);
  p.fixedR=9;p.fixedG=5;p.fixedB=12;
  for(unsigned i=0;i<4;i++){
    p.bgsc[i]=(std::uint8_t)(i*4u);
    p.bgnba[i]=(std::uint8_t)i;
    p.scrollX[i]=(std::uint16_t)(rnd(seed)&255u);
    p.scrollY[i]=(std::uint16_t)(rnd(seed)&255u);
  }
  p.regs[3]=(std::uint8_t)(scenario&1u?0x80u:0u);
  p.oamAddr=(std::uint16_t)(rnd(seed)&511u);
  p.m7[0]=0x100;p.m7[3]=0x100;
  return p;
}
int main(){
  try{
    std::uint64_t compared=0;
    for(unsigned mode=0;mode<8;mode++)for(unsigned scenario=0;scenario<3;scenario++){
      PpuState p=makePpu(mode,scenario);
      for(int y:{0,7,31,119,223}){
        std::vector<std::uint32_t> got;
        p.renderScanline(got,y,256);
        for(int x=0;x<256;x++){
          const auto reference=p.rgba15(p.finalMain15(x,y,false));
          if(got[(std::size_t)y*256u+(unsigned)x]!=reference){
            std::cerr<<"PPU_ROW_MISMATCH mode="<<mode<<" scenario="<<scenario<<" x="<<x<<" y="<<y<<"\n";
            return 2;
          }
          compared++;
        }
      }
    }
    // Force the sprite path, including windows and color math, then compare
    // a full snapshot with the scalar path on representative pixels.
    PpuState p=makePpu(1,2);
    const auto begin=std::chrono::steady_clock::now();
    const auto fb=p.renderFrame(256,224);
    const auto end=std::chrono::steady_clock::now();
    check(fb.size()==256u*224u,"snapshot dimensions");
    for(int y=0;y<224;y+=19)for(int x=0;x<256;x+=13){
      check(fb[(std::size_t)y*256u+x]==p.rgba15(p.finalMain15(x,y,false)),"full frame pixel mismatch");
      compared++;
    }
    p.write(0x2100,0x80);std::vector<std::uint32_t> blank;
    p.renderScanline(blank,0,256);
    for(const auto pixel:blank)check(pixel==0xFF000000u,"forced-blank row");
    std::cout<<"TETRIS_PPU_SNAPSHOT_ROW_PARITY_PASS pixels="<<compared
             <<" full_frame_ms="<<std::chrono::duration_cast<std::chrono::milliseconds>(end-begin).count()<<"\n";
    return 0;
  }catch(const std::exception&e){std::cerr<<"TETRIS_PPU_SNAPSHOT_ROW_FAIL "<<e.what()<<'\n';return 1;}
}
