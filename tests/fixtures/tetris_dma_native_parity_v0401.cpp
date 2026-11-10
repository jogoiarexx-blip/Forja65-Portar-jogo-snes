#include "runtime.hpp"
#include <algorithm>
#include <cstdint>
#include <iostream>
#include <stdexcept>

static void check(bool ok,const char*message){if(!ok)throw std::runtime_error(message);}
static void compare(const SnesRuntime&a,const SnesRuntime&b){
  check(a.ram==b.ram,"DMA WRAM differs");
  check(a.ppu.vram==b.ppu.vram,"DMA VRAM differs");
  check(a.ppu.cgram==b.ppu.cgram,"DMA CGRAM differs");
  check(a.ppu.oam==b.ppu.oam,"DMA OAM differs");
  check(a.ppu.vmadd==b.ppu.vmadd&&a.ppu.oamAddr==b.ppu.oamAddr&&a.ppu.cgAddr==b.ppu.cgAddr,"DMA port address differs");
  check(a.ppu.vramReadBuffer==b.ppu.vramReadBuffer,"DMA VRAM prefetch differs");
  check(a.ppu.objRangeTimeFlags==b.ppu.objRangeTimeFlags,"DMA sprite flags differ");
  check(a.io.wramPortAddr==b.io.wramPortAddr,"DMA WRAM port address differs");
  check(a.cpuMasterClock==b.cpuMasterClock,"DMA master clock differs");
  check(a.apu.spcMasterRemainder==b.apu.spcMasterRemainder,"DMA SPC700 cycle remainder differs");
  check(a.apu.dspMasterRemainder==b.apu.dspMasterRemainder,"DMA DSP cycle remainder differs");
  check(a.framebufferHash()==b.framebufferHash(),"DMA output framebuffer differs");
  for(int i=0;i<8;i++){
    check(a.dma[i].a1t==b.dma[i].a1t&&a.dma[i].das==b.dma[i].das,"DMA source register differs");
  }
  check(a.hwUsage.dmaBytes==b.hwUsage.dmaBytes,"DMA total bytes differs");
  check(a.hwUsage.ppuWrites==b.hwUsage.ppuWrites&&a.hwUsage.ppuReads==b.hwUsage.ppuReads,"DMA PPU accesses differ");
}
static void transfer(SnesRuntime&a,SnesRuntime&b,unsigned mode,unsigned bbad,unsigned source,unsigned count,bool reverse=false){
  for(SnesRuntime*hw:{&a,&b}){
    auto&d=hw->dma[0];d={};d.dmap=(std::uint8_t)(mode|(reverse?0x80:0));d.bbad=(std::uint8_t)bbad;
    d.a1b=(std::uint8_t)(source>>16);d.a1t=(std::uint16_t)source;d.das=(std::uint16_t)count;
    hw->executeDma(1);
  }
  compare(a,b);
}
int main(){
 try{
  SnesRuntime a("assets/cart-data.bin",MapperKind::LoROM,0,10,0,CartChip::None,"dma-native-parity-a.srm",1,true);
  SnesRuntime b("assets/cart-data.bin",MapperKind::LoROM,0,10,0,CartChip::None,"dma-native-parity-b.srm",1,true);
  check(b.nativeDmaEnabled,"default must use native B-bus DMA path");
  a.nativeDmaEnabled=false;b.nativeDmaEnabled=true;
  for(unsigned i=0;i<0x20000;i++){a.ram[i]=b.ram[i]=(std::uint8_t)(i*37u+11u);}
  for(unsigned i=0;i<0x10000;i++){a.ppu.vram[i]=b.ppu.vram[i]=(std::uint8_t)(i*13u+7u);}
  for(SnesRuntime*hw:{&a,&b}){
    hw->ppu.write(0x2100,15);
    hw->ppu.write(0x2115,0x80);hw->ppu.write(0x2116,0xFE);hw->ppu.write(0x2117,0x7F);
  }
  // ROM/WRAM -> VRAM with 16-bit source wrap, 2 B-bus ports.
  transfer(a,b,1,0x18,0x7EFFFE,16);
  // VRAM -> WRAM read (port side effects must remain identical).
  transfer(a,b,1,0x39,0x7E3000,12,true);
  for(SnesRuntime*hw:{&a,&b}){
    hw->ppu.write(0x2102,0);hw->ppu.write(0x2103,0);
  }
  transfer(a,b,0,0x04,0x7E0040,7);
  for(SnesRuntime*hw:{&a,&b})hw->ppu.write(0x2121,0xF0);
  transfer(a,b,0,0x22,0x7E0040,7);
  // WRAM direct-port, APU and unsupported B-bus fallback.
  for(SnesRuntime*hw:{&a,&b})hw->io.wramPortAddr=0x1FFFC;
  transfer(a,b,0,0x80,0x7E0100,8);
  transfer(a,b,0,0x40,0x7E0110,8);
  transfer(a,b,0,0xFF,0x7E0100,3);
  check(a.hwUsage.dmaFallbackBytes==a.hwUsage.dmaBytes,"reference uses generic B-bus");
  check(b.hwUsage.dmaNativeBytes>0,"native accelerated B-bus not taken");
  check(b.hwUsage.dmaFallbackBytes>0,"unsupported B-bus must retain fallback");
  std::cout<<"TETRIS_DMA_NATIVE_PARITY_PASS bytes="<<b.hwUsage.dmaBytes
           <<" native="<<b.hwUsage.dmaNativeBytes
           <<" unsupported_fallback="<<b.hwUsage.dmaFallbackBytes<<"\n";
  return 0;
 }catch(const std::exception&e){std::cerr<<"TETRIS_DMA_NATIVE_PARITY_FAIL "<<e.what()<<'\n';return 1;}
}
