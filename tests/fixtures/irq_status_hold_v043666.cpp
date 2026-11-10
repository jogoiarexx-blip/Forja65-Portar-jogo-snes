#include "runtime.hpp"
#include <iostream>
#include <cstdint>
// Reference: pinned ares cpu/irq.cpp rdnmi/timeup return status but only
// clear it when nmiHold/irqHold are false. Holds last four master clocks.
static unsigned failures=0,cases=0;
static void check(bool b,const char *label){++cases;if(!b){if(failures<8)std::cerr<<label<<"\n";++failures;}}
static void setup(SnesRuntime &h){h.beginFrame();h.beginScanline(20);h.setMasterCycle(100);h.cpuMasterClock=1000;}
int main(){
 for(unsigned bank:{0x00u,0x3fu,0x80u,0xbfu})for(unsigned offset=0;offset<=5;++offset){
  // Trigger through real scheduler advance, not a test-only hold setter.
  SnesRuntime h;setup(h);h.write8(0x4200,0x10);h.write8(0x4207,30);h.write8(0x4208,0);
  unsigned event=h.irqHMasterCycle();h.advanceCpuMasterCycles(event-h.currentMasterCycle);
  h.advanceCpuMasterCycles(offset);h.cpuDataBus=0x55;
  check(h.read((bank<<16)|0x4211)==0xd5,"TIMEUP return/open bus");
  check(h.io.irqPending==(offset<4),"TIMEUP status hold");
  check(h.cpuIrqInterruptPending==(offset<4),"TIMEUP transition hold");
  check((h.read((bank<<16)|0x4211)&0x80u)==(offset<4?0x80u:0u),"TIMEUP repeated read");
  if(offset<4){h.advanceCpuMasterCycles(4-offset);check(h.read(0x4211)&0x80u,"TIMEUP acknowledge after hold");check(!h.io.irqPending&&!h.cpuIrqInterruptPending,"TIMEUP released");}
  // IRQ disable overrides its hold; no stale held status can reappear.
  h.write8(0x4200,0);check(!(h.read(0x4211)&0x80u),"IRQ disabled");

  SnesRuntime n;setup(n);n.write8(0x4200,0x80);n.currentScanline=n.visibleLines();n.setMasterCycle(0);n.io.vblank=true;
  n.advanceCpuMasterCycles(n.NMI_TRIGGER_MC);n.advanceCpuMasterCycles(offset);n.cpuDataBus=0x70;
  check(n.read((bank<<16)|0x4210)==0xf2,"RDNMI return/open bus");
  check(n.io.nmiPending==(offset<4),"RDNMI status hold");
  check(n.cpuNmiInterruptPending,"RDNMI must retain CPU edge");
  check((n.read((bank<<16)|0x4210)&0x80u)==(offset<4?0x80u:0u),"RDNMI repeated read");
  if(offset<4){n.advanceCpuMasterCycles(4-offset);check(n.read(0x4210)&0x80u,"RDNMI acknowledge after hold");check(!n.io.nmiPending&&n.cpuNmiInterruptPending,"RDNMI released, edge retained");}
 }
 // Alternate scanline helpers must establish exactly the same hold.
 for(bool nmi:{false,true})for(unsigned offset=0;offset<=4;++offset){
   SnesRuntime h;setup(h);h.write8(0x4200,nmi?0x80:0x10);
   if(nmi)h.beginVblank(h.visibleLines());
   else{h.io.htime=30;check(h.fireIrqAt(20,h.irqHMasterCycle()),"helper IRQ fired");}
   h.advanceCpuMasterCycles(offset);
   check(h.read(nmi?0x4210:0x4211)&0x80u,"helper read asserted");
   check((nmi?h.io.nmiPending:h.io.irqPending)==(offset<4),"helper hold");
 }
 // CPU servicing consumes the NMI edge, independent of the status read.
 // Its existing entry cycles naturally expire the short status hold.
 for(bool nmi:{false,true}){
   SnesRuntime h;setup(h);h.cart.resize(0x8000);h.romLogicalSize=h.cart.size();
   h.write8(0x4200,nmi?0x80:0x10);
   if(nmi)h.beginVblank(h.visibleLines());else{h.io.htime=30;h.fireIrqAt(20,h.irqHMasterCycle());}
   CpuState c;c.i=false;
   check(h.serviceCpuEvents(c,0x008000),"CPU serviced");
   check(nmi?!h.cpuNmiInterruptPending:h.cpuIrqInterruptPending,"service preserves edge versus level");
   check(h.read(nmi?0x4210:0x4211)&0x80u,"status remains after CPU service");
   check(!(nmi?h.io.nmiPending:h.io.irqPending),"service expired hold acknowledges");
   check(!h.cpuNmiInterruptPending&&!h.cpuIrqInterruptPending,"no new event after acknowledge");
 }
 // A previously latched status (not in its hold) remains acknowledgeable.
 SnesRuntime h;h.io.nmiPending=h.io.irqPending=true;h.cpuNmiInterruptPending=h.cpuIrqInterruptPending=true;
 check(h.read(0x4210)&0x80u,"manual RDNMI set");check(!h.io.nmiPending&&h.cpuNmiInterruptPending,"manual RDNMI clear");
 check(h.read(0x4211)&0x80u,"manual TIMEUP set");check(!h.io.irqPending&&!h.cpuIrqInterruptPending,"manual TIMEUP clear");
 std::cout<<"IRQ_STATUS_HOLD_V043666 cases="<<cases<<" failures="<<failures<<"\n";return failures?1:0;
}
