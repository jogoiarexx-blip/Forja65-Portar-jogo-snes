#include "runtime.hpp"
#include <cassert>
#include <cstdint>
#include <iostream>

int main(){
  unsigned cases=0;
  // The internal cursor is restored to the OAMADD latch on a 1->0 INIDISP
  // forced-blank transition (even if OAM activity moved the cursor).
  for(unsigned address=0; address<512; ++address){
    PpuState p;
    p.write(0x2100u,0x80u);
    p.write(0x2102u,(std::uint8_t)address);
    p.write(0x2103u,(std::uint8_t)(address>>8));
    p.write(0x2104u,0xA5u);
    p.write(0x2104u,0x5Au);
    // Leave both read and write toggles in-flight.
    p.write(0x2104u,0xC3u);
    p.read(0x2138u);
    const auto preserved=p.oam;
    assert(p.oamAddr != address || p.oamFlip || p.oamReadFlip);
    p.write(0x2100u,0x0Fu);
    assert(!p.forceBlank && p.brightness==15u);
    assert(p.oamAddr==address && !p.oamFlip && !p.oamReadFlip);
    assert(p.oam==preserved);
    ++cases;
  }
  // No reset if forced blank remains enabled, or if the brightness alone
  // changes while already displaying.
  for(unsigned addr=0;addr<256;++addr){
    PpuState p;
    p.write(0x2100u,0x80u);
    p.write(0x2102u,(std::uint8_t)addr);
    p.write(0x2104u,0x11u);p.write(0x2104u,0x22u);p.write(0x2104u,0x33u);
    const auto before=p.oamAddr;
    const auto flip=p.oamFlip;
    p.write(0x2100u,0x8Fu);
    assert(p.oamAddr==before&&p.oamFlip==flip);
    p.write(0x2100u,0x0Fu);
    p.write(0x2104u,0x44u);
    const auto after=p.oamAddr;
    p.write(0x2100u,0x07u);
    assert(p.oamAddr==after);
    ++cases;
  }
  // CPU, DMA, HDMA all converge on the same PPU INIDISP transition.
  for(unsigned method=0;method<3;++method){
    SnesRuntime hw;
    hw.headless=true;
    hw.nativeDmaEnabled=true;
    hw.frameTimingActive=true;
    hw.currentScanline=40u;
    hw.currentMasterCycle=1110u; // HBlank, HDMA can write INIDISP.
    hw.ppu.write(0x2100u,0x80u);
    hw.ppu.write(0x2102u,0x45u);
    hw.ppu.write(0x2103u,0x00u);
    hw.ppu.write(0x2104u,0x12u);
    hw.ppu.write(0x2104u,0x34u);
    assert(hw.ppu.oamAddr!=0x45u);
    if(method==0){
      hw.write8(0x002100u,0x0Fu);
    }else if(method==1){
      hw.ram[0]=0x0Fu;
      auto& d=hw.dma[0];d.dmap=0u;d.bbad=0u;d.a1b=0x7Eu;d.a1t=0u;d.das=1u;
      hw.executeDma(1u);
    }else{
      hw.ram[0x100]=0x0Fu;
      auto& d=hw.dma[0];d.dmap=0u;d.bbad=0u;d.a1b=0x7Eu;d.a2a=0x100u;
      hw.hdmaActive=1u;hw.hdmaLines[0]=1;hw.hdmaTransfer[0]=true;
      hw.executeHdmaLine();
    }
    assert(hw.ppu.oamAddr==0x45u);
    assert(!hw.ppu.oamFlip && !hw.ppu.oamReadFlip);
    assert(hw.ppu.forceBlank==false);
    ++cases;
  }
  // VBlank reset is preserved, and VBlank during forced blank does not reset.
  for(bool forced:{false,true}){
    SnesRuntime hw;
    hw.headless=true;
    hw.ppu.write(0x2100u, forced?0x80u:0x0Fu);
    hw.ppu.write(0x2102u,0x70u);hw.ppu.write(0x2103u,0u);
    hw.ppu.write(0x2104u,0xABu);hw.ppu.write(0x2104u,0xCDu);
    hw.beginVblank();
    if(forced)assert(hw.ppu.oamAddr==0x71u);
    else assert(hw.ppu.oamAddr==0x70u);
    ++cases;
  }
  std::cout<<"PPU_OAM_FORCEBLANK_RESET_V043662_PASS cases="<<cases<<"\n";
}
