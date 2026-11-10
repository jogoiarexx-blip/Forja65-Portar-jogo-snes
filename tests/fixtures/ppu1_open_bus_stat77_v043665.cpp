#include "runtime.hpp"
#include <cassert>
#include <cstdint>
#include <iostream>
int main(){
  unsigned cases=0;
  for(unsigned sample=0;sample<256;sample++){
    // The PPU1 output bus latch receives OAMDATAREAD, not PPU2 outputs or writes.
    PpuState p;
    p.write(0x2100,0x80);
    p.write(0x2102,0);p.write(0x2103,0);
    p.oam[0]=(std::uint8_t)sample;
    assert(p.read(0x2138)==sample);
    assert(p.ppu1OpenBus==sample);
    assert(p.read(0x213E)==(1u|(sample&0x10u)));
    ++cases;
    // PPU2 CGRAM/STAT78 reads must not change the PPU1 latch.
    p.cgram[0]=(std::uint8_t)(sample^0xFFu);
    p.write(0x2121,0);
    assert(p.read(0x213B)==(sample^0xFFu));
    p.read(0x213F);
    p.write(0x2101,0x3fu);
    assert(p.read(0x213E)==(1u|(sample&0x10u)));
    ++cases;
    // STAT77 keeps bits 7/6 from sprite flags; bit 4 is still PPU1 open bus.
    p.objRangeTimeFlags=0xC0u;
    assert(p.read(0x213E)==(0xC1u|(sample&0x10u)));
    ++cases;
    // The low VRAM read port updates PPU1 output bus.
    p.write(0x2115,0x80);p.write(0x2116,0);p.write(0x2117,0);
    p.vram[0]=(std::uint8_t)sample;p.updateVramReadBuffer();
    assert(p.read(0x2139)==sample);
    assert(p.read(0x213E)==(0xC1u|(sample&0x10u)));
    ++cases;
    // And the high VRAM read port updates it independently.
    p.vram[1]=(std::uint8_t)(sample^0x10u);p.updateVramReadBuffer();
    assert(p.read(0x213A)==(sample^0x10u));
    assert(p.read(0x213E)==(0xC1u|((sample^0x10u)&0x10u)));
    ++cases;
    // Mode7 product registers participate in the PPU1 output latch too.
    p.m7[0]=0x1000u;p.m7[1]=0x0100u;
    assert(p.read(0x2134)==0x00u);
    assert(p.read(0x213E)==0xC1u);
    assert(p.read(0x2135)==0x10u);
    assert(p.read(0x213E)==0xD1u);
    ++cases;
  }
  // DMA reverse B-bus reads must update the same PPU1 latch, regardless of mode.
  for(bool native:{false,true}){
    SnesRuntime hw;hw.headless=true;hw.nativeDmaEnabled=native;
    hw.ppu.write(0x2100,0x80);hw.ppu.write(0x2102,0);hw.ppu.write(0x2103,0);
    hw.ppu.oam[0]=0x50u;
    auto &d=hw.dma[0];d.dmap=0x80u;d.bbad=0x38u;d.a1b=0x7Eu;d.a1t=0x800u;d.das=1;
    hw.executeDma(1);
    assert(hw.ram[0x800]==0x50u);
    assert(hw.ppu.read(0x213E)==0x11u);
    ++cases;
  }
  std::cout<<"PPU1_OPEN_BUS_STAT77_V043665_PASS cases="<<cases<<"\n";
}
