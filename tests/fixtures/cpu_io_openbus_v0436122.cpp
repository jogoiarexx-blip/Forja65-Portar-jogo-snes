#include "runtime.hpp"
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <vector>
static void check(bool condition, const char* reason) { if(!condition)throw std::runtime_error(reason); }
int main() {
 try {
  SnesRuntime h;h.headless=true;
  h.write8(0x004200u,0x81u);h.write8(0x004201u,0x7bu);
  h.write8(0x00420cu,0x5au);h.write8(0x00420du,0x01u);
  h.io.wramPortAddr=0x12345u;
  const unsigned banks[]={0x00u,0x3fu,0x80u,0xbfu};
  const std::uint8_t probes[]={0x01u,0xa5u,0xf0u,0x5au};
  unsigned checks=0;
  for(unsigned bank : banks)for(std::uint8_t expected : probes){
   for(unsigned reg=0x4200u;reg<=0x420du;reg++){
    h.ram[0x700]=expected;check(h.read(0x7e0700u)==expected,"seed CPU MDR");
    const auto v=h.read((bank<<16)|reg);
    check(v==expected,"CPU write-only MMIO must return open bus");
    check(h.cpuDataBus==expected,"open bus must preserve CPU MDR");checks+=2;
   }
   for(unsigned reg=0x2181u;reg<=0x2183u;reg++){
    h.ram[0x700]=expected;h.read(0x7e0700u);
    const auto old=h.io.wramPortAddr;
    check(h.read((bank<<16)|reg)==expected,"WMADD read must be open bus");
    check(h.io.wramPortAddr==old,"WMADD read advanced the pointer");checks+=2;
   }
  }
  // RDIO ($4213) is read-only and MUST remain observable.
  for(unsigned bank : banks){
   h.ram[0x700]=0u;h.read(0x7e0700u);
   check(h.read((bank<<16)|0x4213u)==h.io.wrio,"RDIO must return WRIO output state");checks++;
  }
  // Manual controller serial data drives bits 0/1 only. The remaining bits
  // differ for JOYSER0 and JOYSER1, and reads clock the serial shift.
  for(unsigned bank : banks)for(std::uint8_t expected : probes){
   for(unsigned port=0;port<2;port++){
    h.io.joyStrobe=false;h.io.joyShift[port]=0x8000u;
    h.ram[0x700]=expected;h.read(0x7e0700u);
    const auto addr=(bank<<16)|(port?0x4017u:0x4016u);
    const auto wanted=port?std::uint8_t((expected&0xe0u)|0x1du):std::uint8_t((expected&0xfcu)|1u);
    check(h.read(addr)==wanted,"JOYSER open-bus/constant mask");
    check(h.io.joyShift[port]==1u,"JOYSER must shift once per read");checks+=2;
   }
  }
  // A bus DMA register exclusion is separate from CPU open-bus reads:
  // The SNES DMA engine explicitly drives zero for an invalid A-bus read.
  h.ram[0x700]=0xd7u;h.read(0x7e0700u);
  check(h.dmaReadAbus(0x004200u)==0u,"DMA invalid A bus must drive zero");checks++;
  std::cout<<"CPU_IO_OPENBUS_V0436122_PASS checks="<<checks<<"\n";
  return 0;
 }catch(const std::exception& e){std::cerr<<"CPU_IO_OPENBUS_V0436122_FAIL "<<e.what()<<'\n';return 1;}
}
