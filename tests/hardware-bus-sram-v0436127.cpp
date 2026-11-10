#include "runtime.hpp"
#include <cstdint>
#include <iostream>
#include <string>

int main(int argc,char** argv){
  const bool strict=(argc>1 && std::string(argv[1])=="--strict");
  unsigned ok=0,fail=0,ppuOk=0,ppuFail=0,saveOk=0,saveFail=0;
  auto check=[&](bool yes,const char* what){
    const std::string tag(what);
    const bool ppu=tag.find("PPU")!=std::string::npos || tag.find("SLHV")!=std::string::npos || tag.find("write-only")!=std::string::npos;
    if(yes){++ok;if(ppu)++ppuOk;else ++saveOk;}
    else{++fail;if(ppu)++ppuFail;else ++saveFail;
      if(fail<=10)std::cerr<<"MISMATCH "<<what<<"\n";}
  };
  // SNES CPU open bus, not last-written PPU value. One read for each
  // write-only PPU port except PPU1-specific MDR mirror ports.
  SnesRuntime cpu;
  for(unsigned k=0;k<4;k++){
    const unsigned char bus=(unsigned char)(0xA5u+k*17u);
    cpu.cpuDataBus=bus;
    for(unsigned reg=0x2100;reg<=0x2133;reg++){
      const unsigned nibble=reg&15u;
      const bool ppu1=(reg>=0x2100&&reg<=0x212Fu)&&
         ((nibble>=4&&nibble<=6)||(nibble>=8&&nibble<=10));
      if(ppu1)continue;
      cpu.ppu.write((std::uint16_t)reg,(std::uint8_t)(bus^0xFFu));
      check(cpu.ppuPortRead((std::uint16_t)reg)==bus,"write-only PPU bus");
    }
  }
  // The PPU1 MDR mirrors are independent from the CPU data bus.
  cpu.ppu.ppu1OpenBus=0x49;cpu.cpuDataBus=0xA7;
  for(unsigned r:{0x2104u,0x2105u,0x2106u,0x2108u,0x2109u,0x210Au,
                  0x2114u,0x2115u,0x2116u,0x2118u,0x2119u,0x211Au,
                  0x2124u,0x2125u,0x2126u,0x2128u,0x2129u,0x212Au})
    check(cpu.ppuPortRead((std::uint16_t)r)==0x49,"PPU1 MDR mirrors");
  // $2137 only latches H/V counters; its read data must remain open bus.
  cpu.cpuDataBus=0x6d;cpu.ppu.hCounter=0x146;cpu.ppu.vCounter=0x19a;
  check(cpu.ppuPortRead(0x2137)==0x6d,"SLHV open bus");
  check(cpu.ppu.latchedHCounter==0x146&&cpu.ppu.latchedVCounter==0x19a,"SLHV side effect");
  // HiROM SRAM $20-$3F / $A0-$BF, $6000-$7FFF: 256 KiB must not
  // alias the upper 16 banks into the first 128 KiB.
  SnesRuntime ram;ram.mapper=MapperKind::HiROM;ram.sram.assign(256u*1024u,0xffu);
  for(unsigned b=0;b<32;b++){
    const unsigned char v=(unsigned char)(b+1u);
    ram.write8(((0x20u+b)<<16)|0x6000u,v);
  }
  for(unsigned b=0;b<32;b++){
    const auto expected=(unsigned char)(b+1u);
    check(ram.sram[b*8192u]==expected,"HiROM 256K bank unique");
    check(ram.read(((0xA0u+b)<<16)|0x6000u)==expected,"HiROM upper mirror");
    check(ram.sramOffset(((0x20u+b)<<16)|0x8000u)==(std::size_t)-1,"HiROM SRAM address range");
  }
  // LoROM standard SRAM/ROM split and WRAM maps should not regress.
  SnesRuntime lorom;lorom.mapper=MapperKind::LoROM;lorom.sram.assign(32u*1024u,0xffu);
  lorom.write8(0x700200u,0x71);check(lorom.read(0xF00200u)==0x71,"LoROM save bank alias");
  check(lorom.wramOffset(0x7E0000u)==0,"WRAM bank 7e");
  check(lorom.wramOffset(0x7FFFFFu)==0x1ffffu,"WRAM bank 7f");
  std::cout<<"REV127_HARDWARE_CHECK pass="<<ok<<" fail="<<fail<<" total="<<(ok+fail)
           <<" ppu="<<ppuOk<<"/"<<(ppuOk+ppuFail)
           <<" sram_wram="<<saveOk<<"/"<<(saveOk+saveFail)<<"\n";
  return strict&&fail?1:0;
}
