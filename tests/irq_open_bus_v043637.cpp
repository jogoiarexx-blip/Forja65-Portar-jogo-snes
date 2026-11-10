// v0.4.36.37: generated-runtime validation of RDNMI, TIMEUP, HVBJOY open-bus masks.
#include "runtime.hpp"
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <string>
static void check(bool ok, const std::string& msg) {if(!ok) throw std::runtime_error(msg);}
int main() {try {
  constexpr std::uint32_t banks[]={0x000000u,0x3f0000u,0x800000u,0xbf0000u};
  unsigned tested=0;
  for(auto bank:banks)for(unsigned seed=0;seed<256;++seed){
    SnesRuntime hw;
    // The bus latch is set by the preceding CPU transaction, never by a probe.
    hw.write8(0x7e0010u,std::uint8_t(seed));
    hw.io.nmiPending=true;hw.io.irqPending=true;
    hw.cpuNmiInterruptPending=true;hw.cpuIrqInterruptPending=true;
    auto v=hw.read(bank|0x4210u);
    check(v==(unsigned(0x82u|(seed&0x70u))),"RDNMI mask or version");
    check(!hw.io.nmiPending && hw.cpuNmiInterruptPending,"RDNMI must clear status, not latched edge");
    check(hw.read(bank|0x4210u)==(unsigned(0x02u|(seed&0x70u))),"RDNMI must clear flag on second read");
    hw.write8(0x7e0010u,std::uint8_t(seed));
    v=hw.read(bank|0x4211u);
    check(v==(unsigned(0x80u|(seed&0x7fu))),"TIMEUP open bus mask");
    check(!hw.io.irqPending && !hw.cpuIrqInterruptPending,"TIMEUP did not acknowledge IRQ");
    check(hw.read(bank|0x4211u)==(unsigned(seed&0x7fu)),"TIMEUP flag did not clear");
    for(bool vb:{false,true})for(bool hb:{false,true}){
      hw.io.vblank=vb;hw.io.hblank=hb;
      hw.write8(0x7e0010u,std::uint8_t(seed));
      v=hw.read(bank|0x4212u);
      check(v==unsigned((vb?0x80u:0u)|(hb?0x40u:0u)|(seed&0x3eu)),"HVBJOY open-bus bits");
      ++tested;
    }
  }
  std::cout<<"FORJA65_IRQ_OPEN_BUS_37_PASS cases="<<tested<<"\n";
  return 0;
} catch(const std::exception&e){std::cerr<<"FORJA65_IRQ_OPEN_BUS_37_FAIL "<<e.what()<<"\n";return 1;}}
