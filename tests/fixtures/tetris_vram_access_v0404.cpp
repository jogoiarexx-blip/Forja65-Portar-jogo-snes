#include "runtime.hpp"
#include <cstdint>
#include <iostream>
#include <stdexcept>

static void require(bool okay,const char*why){if(!okay)throw std::runtime_error(why);}

static void vramReadLatch(){
  PpuState p;
  p.vram[0]=0x12;p.vram[1]=0xA1;p.vram[2]=0x34;p.vram[3]=0xB2;
  p.write(0x2115,0);p.write(0x2116,0);p.write(0x2117,0);
  require(p.read(0x2139)==0x12,"low first value");
  require(p.vmadd==1,"increment after low access");
  require(p.read(0x2139)==0x12,"low read must be one word behind");
  require(p.read(0x2139)==0x34,"low read subsequent word");
  p.write(0x2115,0x80);p.write(0x2116,0);p.write(0x2117,0);
  require(p.read(0x213A)==0xA1,"high first value");
  require(p.vmadd==1,"increment after high access");
  require(p.read(0x213A)==0xA1,"high read must be one word behind");
  require(p.read(0x213A)==0xB2,"high read subsequent word");
  p.write(0x2115,0);p.write(0x2116,0);p.write(0x2117,0);
  require(p.read(0x213A)==0xA1,"nonincrement port returns original high byte");
  require(p.vmadd==0,"nonincrementing access changed address");
  // Non-unit increments and wrapping still apply after the fetch.
  p.vram[64]=0xC3;
  p.write(0x2115,1);p.write(0x2116,0);p.write(0x2117,0);
  require(p.read(0x2139)==0x12&&p.read(0x2139)==0x12&&p.read(0x2139)==0xC3,"increment by 32");
  p.vram[65534]=0xD4;
  p.write(0x2115,0);p.write(0x2116,0xFF);p.write(0x2117,0xFF);
  require(p.read(0x2139)==0xD4&&p.read(0x2139)==0xD4&&p.read(0x2139)==0x12,"VRAM word address wrap");
}
static void vramBusyRules(){
  SnesRuntime h;
  h.frameTimingActive=true;h.currentScanline=18;h.currentMasterCycle=500;
  h.ppu.write(0x2115,0);h.ppu.write(0x2116,0);h.ppu.write(0x2117,0);
  h.ppuPortWrite(0x2118,0xAA);
  require(h.ppu.vram[0]==0&&h.ppu.vmadd==1&&h.vramBlockedWrites==1,"active display low write must be dropped but advance address");
  h.ppu.write(0x2115,0x80);h.ppu.write(0x2116,0);h.ppu.write(0x2117,0);
  h.currentMasterCycle=SnesRuntime::HBLANK_START_MC+8u;
  h.ppuPortWrite(0x2119,0xBB);
  require(h.ppu.vram[1]==0&&h.ppu.vmadd==1&&h.vramBlockedWrites==2,"HBlank high write must be dropped but advance address");
  h.ppu.write(0x2100,0x80); // forced blank overrides active display
  h.ppu.write(0x2115,0);h.ppu.write(0x2116,0);h.ppu.write(0x2117,0);
  h.ppuPortWrite(0x2118,0x11);
  require(h.ppu.vram[0]==0x11&&h.vramBlockedWrites==2,"forced blank VRAM write rejected");
  h.ppu.write(0x2100,0x0F);
  h.currentScanline=h.visibleLines();h.currentMasterCycle=0;
  h.ppu.write(0x2116,0);h.ppu.write(0x2117,0);
  h.ppuPortWrite(0x2118,0x22);
  require(h.ppu.vram[0]==0x22,"VBlank VRAM write rejected");
}
static void dmaCannotBypassVramBusy(){
  SnesRuntime h;h.frameTimingActive=true;h.currentScanline=21;h.currentMasterCycle=SnesRuntime::HBLANK_START_MC+5u;
  h.ram[0]=0xDA;h.ram[1]=0xDB;
  h.ppu.write(0x2115,0);h.ppu.write(0x2116,0);h.ppu.write(0x2117,0);
  auto &d=h.dma[0];d.dmap=0;d.bbad=0x18;d.a1b=0x7E;d.a1t=0;d.das=2;
  h.executeDma(1);
  require(h.ppu.vram[0]==0&&h.ppu.vram[2]==0,"DMA wrote VRAM in HBlank");
  require(h.ppu.vmadd==2&&h.vramBlockedWrites==2,"DMA did not advance blocked registers");
  require(h.dmaVramFastBytes==0,"fast DMA bypassed VRAM access restriction");
}
int main(){try{vramReadLatch();vramBusyRules();dmaCannotBypassVramBusy();std::cout<<"TETRIS_VRAM_ACCESS_PASS\n";return 0;}catch(const std::exception& e){std::cerr<<"TETRIS_VRAM_ACCESS_FAIL: "<<e.what()<<'\n';return 1;}}
