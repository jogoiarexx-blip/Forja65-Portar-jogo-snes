#include "runtime.hpp"
#include <cassert>
#include <cstdint>
#include <iostream>
int main(){
 unsigned cases=0;
 for(unsigned low=0;low<256;++low){
  PpuState p;
  p.cgram[0]=(std::uint8_t)low;p.cgram[1]=0x35;
  p.cgram[2]=0;p.cgram[3]=0x62;
  p.write(0x2121,0);
  assert(p.read(0x213B)==low);
  assert(p.read(0x213B)==(0x35u|(low&0x80u)));++cases;
  // A PPU1 read and a PPU register write must not modify the PPU2 latch.
  p.read(0x213E);p.write(0x2100,0x80);
  p.latchedHCounter=0x101;p.hCounterHigh=true;
  assert(p.read(0x213C)==((0x35u|(low&0x80u))&0xFEu|1u));++cases;
  p.latchedVCounter=0x000;p.vCounterHigh=true;
  const unsigned before=p.ppu2OpenBus;
  assert(p.read(0x213D)==(before&0xFEu));++cases;
  // STAT78 bit 5 is open bus, other status bits are still driven.
  p.ppu2OpenBus=(std::uint8_t)low;
  p.stat78Pal=true;p.stat78Field=true;p.counterLatched=true;
  assert(p.read(0x213F)==(0xD3u|(low&0x20u)));++cases;
 }
 for(bool native:{false,true}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;
  h.ppu.cgram[0]=0x92;h.ppu.cgram[1]=0x33;
  h.ppu.write(0x2121,0);
  auto& d=h.dma[0];d.dmap=0x80;d.bbad=0x3b;d.a1b=0x7e;d.a1t=0x0800;d.das=2;
  h.executeDma(1);
  assert(h.ram[0x800]==0x92);
  assert(h.ram[0x801]==0xB3);
  assert(h.ppu.cgAddr==1);
  cases+=3;
 }
 // Reverse HDMA reads the same PPU2 port and writes an A-bus byte.
 for(bool native:{false,true}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;
  h.ppu.forceBlank=true;h.beginFrame();h.currentScanline=225;h.currentMasterCycle=100;h.ppu.cgram[0]=0xFA;h.ppu.cgram[1]=0x42;h.ppu.write(0x2121,0);
  auto& d=h.dma[0];d.dmap=0x80;d.bbad=0x3b;d.a1b=0x7e;d.a2a=0x0110;
  h.ram[0x110]=0x81;h.hdmaActive=1;h.hdmaLines[0]=0;h.reloadHdmaChannel(0);
  h.executeHdmaLine();
  assert(h.ram[0x111]==0xFA);
  cases+=2;
 }
 std::cout<<"PPU2_OPEN_BUS_DMA_V043660_PASS cases="<<cases<<"\n";
}
