#include "runtime.hpp"
#include <iostream>
#include <memory>
#include <chrono>
static std::uint32_t rng=0x671f35a9u;
static unsigned random32(){rng^=rng<<13;rng^=rng>>17;rng^=rng<<5;return rng;}
static void state(const SnesRuntime&h,unsigned value){
 std::cout<<h.cpuMasterClock<<','<<h.currentScanline<<','<<h.currentMasterCycle<<','<<h.io.irqPending<<','<<h.cpuIrqInterruptPending<<','<<h.irqComparatorValid<<','<<h.irqFiredThisLine<<','<<h.irqStatusHoldUntil<<','<<h.wramRefreshStallMasterCycles<<','<<value<<','<<unsigned(h.cpuDataBus)<<','<<h.apu.masterObserved<<','<<h.apu.spcExecutedCycles<<','<<h.apu.ntscCycleCredit<<','<<h.apu.spcMasterRemainder<<','<<h.apu.spcHaltClockFraction<<','<<h.apu.dspMasterRemainder<<','<<h.nmiStatusHoldUntil<<','<<h.io.nmiPending<<','<<h.cpuNmiInterruptPending<<'\n';
}
int main(int argc,char**){
 if(argc>1){
  for(unsigned mode=0;mode<4;++mode){auto p=std::make_unique<SnesRuntime>();auto&h=*p;h.headless=true;h.ppu.inidisp=0x80;h.apu.spc.stopped=true;h.beginFrame();h.write8(0x4207,100);h.write8(0x4209,20);h.write8(0x4200,mode<<4);auto start=std::chrono::steady_clock::now();h.advanceCpuMasterCycles(10000000);auto end=std::chrono::steady_clock::now();std::cout<<mode<<' '<<std::chrono::duration<double,std::milli>(end-start).count()<<' '<<h.cpuMasterClock<<' '<<h.currentScanline<<' '<<h.currentMasterCycle<<'\n';}return 0;
 }
 for(unsigned region:{0u,2u})for(unsigned mode=0;mode<4;++mode){
  auto p=std::make_unique<SnesRuntime>();auto&h=*p;h.headless=true;h.regionCode=region;h.beginFrame();h.write8(0x4200,mode<<4);
  // Cover sample boundaries, H=0, H clamp, invalid V values, and mode
  // transitions with and without an intervening low sample.
  for(unsigned k=0;k<40000;++k){unsigned value=999,op=random32()%13,bank=(random32()&1)?0x800000u:0;
   if(k%307==0){h.write8(bank|0x4200,(k/307%4)<<4);h.write8(bank|0x4207,(k/307%3==0)?0:255);h.write8(bank|0x4208,k/307%2);h.write8(bank|0x4209,h.currentScanline&255);h.write8(bank|0x420a,h.currentScanline>>8);}
   switch(op){
    case 0:h.write8(bank|0x4200,(random32()%4)<<4);break;
    case 1:case 2:case 3:case 4:h.write8(bank|(0x4206+op),random32()&255);break;
    case 5:value=h.read(bank|0x4211);break;
    case 6:h.write8(bank|0x4200,0);h.write8(bank|0x4200,0x20);break;
    case 7:h.write8(bank|0x4200,0);h.advanceCpuMasterCycles(random32()%9);h.write8(bank|0x4200,0x20);break;
    default:h.advanceCpuMasterCycles(op==8?random32()%20000:random32()%33);break;
   }
   state(h,value);
  }
 }
}
