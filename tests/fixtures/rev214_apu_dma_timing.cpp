#include "runtime.hpp"
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <string>

static void require(bool condition, const std::string& label) {
  if (!condition) throw std::runtime_error(label);
}

static void setup(SnesRuntime& h) {
  h.headless=true;
  for(unsigned i=0;i<4;++i)h.apu.spc.portOut[i]=std::uint8_t(0xA7u+i);
  h.apu.masterObserved=100;
  // The SPC port changed at master cycle 98.  A genuine S-CPU word read
  // sampled at cycle 90 should observe the old value, whereas a DMA B-bus
  // read at cycle 100 should observe the new value.
  for(unsigned i=0;i<4;++i)h.apu.portOutHistory[i]={98u,std::uint8_t(i),std::uint8_t(0x39u+i)};
  h.apu.portOutHistoryPos=4;
  h.apu.portOutHistoryCount=4;
  h.instrTimingActive=true;
  h.instrDataWidth=2;
  h.instrApuPortReads=0;
}

int main() {
  try {
    // Control: normal S-CPU instruction compensation must be preserved.
    {
      SnesRuntime h;
      setup(h);
      auto value=h.read(0x002140u);
      require(value==0x39,"ordinary S-CPU read lost its instruction-time compensation");
      require(h.instrApuPortReads==1,"ordinary S-CPU read lost its logical data access");
    }
    for(bool native : {false,true}) {
      SnesRuntime h;
      setup(h);
      h.nativeDmaEnabled=native;
      // Same memory and device, only the DMA B-bus backend differs.
      for(unsigned alias=0;alias<64;++alias){
        const auto bus=std::uint16_t(0x2140u+alias);
        const auto destination=std::uint32_t(0x7e0120u+alias);
        const auto expected=std::uint8_t(0xA7u+(alias&3u));
        bool nativeDone=false;
        const auto value=h.dmaTransferByte(destination,bus,true,nativeDone);
        require(value==expected,std::string(native?"native":"virtual")+" DMA sampled stale APU port "+std::to_string(bus));
        require(h.ram[0x120u+alias]==expected,"reverse DMA payload differed from APU port");
        require(h.cpuDataBus==expected,"reverse DMA did not update the S-CPU data bus latch");
        require(h.instrApuPortReads==0,"DMA consumed a surrounding CPU instruction data slot");
        require(nativeDone==native,"native/fallback DMA accounting changed");
        require(h.apu.cpuReadLagMc==0,"DMA left instruction-read compensation active");
      }
      require(h.hwUsage.apuReads==64,"APU port read count differs from 64 B-bus accesses");
      std::cout<<"REV214_APU_DMA_PASS backend="<<(native?"native":"virtual")<<" mirrors=64 reads="<<h.hwUsage.apuReads<<"\n";
    }
    return 0;
  }catch(const std::exception& e){std::cerr<<"REV214_APU_DMA_FAIL "<<e.what()<<'\n';return 1;}
}
