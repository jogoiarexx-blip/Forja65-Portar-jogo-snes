#include "runtime.hpp"
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <vector>

static void need(bool v,const char*what){if(!v)throw std::runtime_error(what);}
static PpuState makeSprites(bool timeQuota){
  PpuState p;
  p.tm=0;p.ts=0;p.brightness=15;p.forceBlank=false;
  for(unsigned i=0;i<128;i++)p.oam[4*i+1]=128;
  if(timeQuota){
    p.obsel=0x40; // 8x8 small, 64x64 large
    for(unsigned i=0;i<5;i++){
      const unsigned o=4*i;
      p.oam[o]=16;p.oam[o+1]=40;
      p.oam[512+(i>>2)]|=(std::uint8_t)(2u<<((i&3u)*2u));
    }
  }else{
    p.obsel=0;
    for(unsigned i=0;i<33;i++){p.oam[4*i]=16;p.oam[4*i+1]=40;}
  }
  return p;
}
int main(){try{
  unsigned cases=0;
  for(bool timeQuota:{false,true}){
    for(unsigned outputPath=0;outputPath<2;outputPath++){
      for(bool brightnessZero:{false,true}){
        for(bool objEnabled:{false,true}){
          PpuState p=makeSprites(timeQuota);
          p.brightness=brightnessZero?0:15;
          p.tm=objEnabled?0x10:0;p.ts=0;
          std::vector<std::uint32_t> frame;
          if(outputPath==0)p.renderScanline(frame,40);
          else p.renderOutputSegment(frame,40,0,64);
          unsigned flags=p.read(0x213E)&0xc0u;
          need(flags==(timeQuota?0x80u:0x40u),"STAT77 flags missed when OBJ output or brightness is disabled");
          need((p.read(0x213E)&0xc0u)==flags,"STAT77 read unexpectedly cleared flags");
          cases++;
        }
      }
    }
  }
  // No spurious flags when the range/tile budgets have not been exceeded.
  for(unsigned path=0;path<2;path++){
    PpuState p=makeSprites(false);
    p.oam[4*32+1]=128;
    std::vector<std::uint32_t> frame;
    if(!path)p.renderScanline(frame,40);else p.renderOutputSegment(frame,40,0,16);
    need((p.read(0x213E)&0xc0u)==0,"false positive for exactly 32 sprites");
    cases++;
  }
  // Rotation selects the first 32 candidates even if the OBJ output is off.
  for(unsigned offset:{0u,1u,64u,127u}){
    PpuState p=makeSprites(false);
    p.regs[3]=0x80u;
    p.oamAddr=(std::uint16_t)(offset*2);
    std::vector<std::uint32_t> frame;
    p.renderOutputSegment(frame,40,0,16);
    need((p.read(0x213E)&0x40u)!=0,"priority rotation lost range-over flag");
    cases++;
  }
  std::cout<<"PPU_OBJ_STATUS_INDEPENDENT_V043667_PASS cases="<<cases<<"\n";
}catch(const std::exception&e){std::cerr<<"PPU_OBJ_STATUS_INDEPENDENT_V043667_FAIL "<<e.what()<<"\n";return 1;}}
