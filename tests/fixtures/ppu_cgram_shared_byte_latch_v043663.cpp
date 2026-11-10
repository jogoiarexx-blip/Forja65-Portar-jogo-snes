#include "runtime.hpp"
#include <cassert>
#include <cstdint>
#include <iostream>

int main(){
  unsigned cases=0;
  // Both ports use one low/high phase. A CGDATA low write followed by a
  // CGDATAREAD high read advances the address but does not commit a color.
  for(unsigned addr=0;addr<256;++addr){
    for(unsigned byte=0;byte<256;++byte){
      PpuState p;
      const unsigned pos=addr*2u;
      p.cgram[pos]=0x2Bu;
      p.cgram[pos+1u]=0x3Fu;
      p.write(0x2121u,(std::uint8_t)addr);
      p.write(0x2122u,(std::uint8_t)byte);
      assert(p.cgHigh && p.cgAddr==addr);
      assert(p.cgram[pos]==0x2Bu && p.cgram[pos+1u]==0x3Fu);
      p.ppu2OpenBus=0x80u;
      assert(p.read(0x213Bu)==0xBFu);
      assert(!p.cgHigh && p.cgAddr==((addr+1u)&255u));
      // The first byte of the next color is now a low write, not a high write.
      p.write(0x2122u,0x55u);
      assert(p.cgHigh && p.cgAddr==((addr+1u)&255u));
      assert(p.cgram[pos]==0x2Bu && p.cgram[pos+1u]==0x3Fu);
      ++cases;
    }
  }
  // A read of the low byte followed by a write uses the high-byte phase;
  // reset through CGADD must restore the low-byte phase in both directions.
  for(unsigned addr=0;addr<256;++addr){
    PpuState p;
    p.write(0x2121u,(std::uint8_t)addr);
    p.cgram[addr*2u]=0x69u;
    assert(p.read(0x213Bu)==0x69u);
    assert(p.cgHigh && p.cgAddr==addr);
    p.write(0x2122u,0x57u);
    assert(!p.cgHigh && p.cgAddr==((addr+1u)&255u));
    assert(p.cgram[addr*2u+1u]==0x57u);
    p.write(0x2121u,(std::uint8_t)addr);
    assert(!p.cgHigh);
    p.write(0x2122u,0x14u);p.write(0x2122u,0x65u);
    assert(p.cgram[addr*2u]==0x14u && p.cgram[addr*2u+1u]==0x65u);
    assert(p.cgAddr==((addr+1u)&255u));
    ++cases;
  }
  // Reverse DMA uses the same PPU2 port: one low read must change the
  // following CPU write into a high write, including the internal wrap.
  for(bool native:{false,true}){
    SnesRuntime hw;
    hw.headless=true;hw.nativeDmaEnabled=native;
    hw.ppu.write(0x2121u,0xFFu);
    hw.ppu.cgram[510]=0x72u;hw.ppu.cgram[511]=0x25u;
    auto& d=hw.dma[0];
    d.dmap=0x80u;d.bbad=0x3Bu;d.a1b=0x7Eu;d.a1t=0x0800u;d.das=1u;
    hw.executeDma(1u);
    assert(hw.ram[0x800u]==0x72u);
    assert(hw.ppu.cgHigh && hw.ppu.cgAddr==255u);
    hw.write8(0x002122u,0x5Bu);
    assert(!hw.ppu.cgHigh && hw.ppu.cgAddr==0u);
    assert(hw.ppu.cgram[511]==0x5Bu);
    ++cases;
  }
  // A CGRAM-address HDMA change resets the common selector. Do not
  // emulate speculative active-display address multiplexing here.
  for(bool native:{false,true}){
    SnesRuntime hw;
    hw.headless=true;hw.nativeDmaEnabled=native;
    hw.ppu.forceBlank=true;hw.beginFrame();
    hw.currentScanline=225u;hw.currentMasterCycle=100u;
    hw.ppu.write(0x2121u,0x05u);
    hw.ppu.write(0x2122u,0x11u);
    assert(hw.ppu.cgHigh);
    auto& d=hw.dma[0];
    d.dmap=0x00u;d.bbad=0x21u;d.a1b=0x7Eu;d.a2a=0x110u;
    hw.ram[0x110u]=0x81u;
    hw.ram[0x111u]=0x3Au;
    hw.hdmaActive=1u;hw.hdmaLines[0]=0;hw.reloadHdmaChannel(0);
    hw.executeHdmaLine();
    assert(hw.ppu.cgAddr==0x3Au && !hw.ppu.cgHigh);
    ++cases;
  }
  std::cout<<"PPU_CGRAM_SHARED_BYTE_LATCH_V043663_PASS cases="<<cases<<"\n";
}
