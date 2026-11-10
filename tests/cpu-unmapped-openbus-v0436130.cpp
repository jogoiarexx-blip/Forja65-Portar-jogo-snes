#include "runtime.hpp"
#include <array>
#include <cstdint>
#include <iostream>
struct Results { unsigned passed{},failed{}; void check(bool good){ if(good)++passed; else ++failed; } };
int main(){
  Results score;
  constexpr std::array<unsigned,6> banks={0x00u,0x15u,0x3fu,0x80u,0xb1u,0xbfu};
  constexpr std::array<unsigned,19> unmapped={
    0x2000u,0x20ffu,0x21ffu,0x2200u,0x2fffu,0x3000u,0x3fffu,
    0x4000u,0x4018u,0x401fu,0x41ffu,0x4220u,0x42ffu,0x4380u,
    0x4400u,0x4fffu,0x5000u,0x6000u,0x7fffu};
  constexpr std::array<unsigned,4> busValues={0x01u,0x5au,0xa5u,0xffu};
  constexpr std::array<MapperKind,3> mappers={MapperKind::LoROM,MapperKind::HiROM,MapperKind::ExHiROM};
  for(auto mapper:mappers){
    SnesRuntime h; h.headless=true; h.mapper=mapper;
    // None of the test instances has cartridge ROM/SRAM or a coprocessor.
    for(unsigned bank:banks) for(unsigned off:unmapped) for(unsigned oldBus:busValues){
      h.cpuDataBus=(std::uint8_t)oldBus;
      const unsigned got=h.read((bank<<16u)|off);
      score.check(got==oldBus);
      score.check(h.cpuDataBus==oldBus);
    }
    // SRAM-less $6000-$7fff must remain open bus, not mirror ROM.
    // Reading a mapped WRAM address must instead drive the byte read.
    h.ram[0x119u]=0x73u;h.cpuDataBus=0x4fu;
    score.check(h.read(0x00119u)==0x73u);
    score.check(h.cpuDataBus==0x73u);
    // The forbidden DMA A-bus decoder is distinct: its read drives 0.
    for(unsigned address:{0x002100u,0x004000u,0x00420bu,0x004300u,0x804217u}){
      h.cpuDataBus=0xe7u;
      score.check(h.dmaReadAbus(address)==0u);
      score.check(h.cpuDataBus==0u);
    }
    // A write to an unmapped location still drives the CPU's write MDR.
    h.write8(0x005000u,0x8cu);score.check(h.cpuDataBus==0x8cu);
    score.check(h.read(0x005000u)==0x8cu);
  }
  std::cout<<"CPU_UNMAPPED_OPENBUS_REV130 pass="<<score.passed<<" fail="<<score.failed<<" total="<<score.passed+score.failed<<"\n";
  return score.failed ? 1:0;
}
