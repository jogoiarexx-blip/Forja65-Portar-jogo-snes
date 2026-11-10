#include "runtime.hpp"
#include <iostream>
#include <memory>
// Source behavior: ares CPU::irqPoll raises irqLine on a false->true
// comparator edge. A V-only match persists through the matching scanline.
// Tests stay far from scanline/H-comparator edges and allow multiple polls;
// they do not prescribe a new absolute trigger timestamp.
static unsigned cases=0,failures=0;
static void check(bool ok,const char*label){++cases;if(!ok){++failures;if(failures<16)std::cerr<<label<<'\n';}}
static void prepare(SnesRuntime&h,unsigned oldMode,bool match,unsigned bank){
 h.headless=true;h.beginFrame();
 h.write8((bank<<16)|0x4207,100);h.write8((bank<<16)|0x4208,0);
 h.write8((bank<<16)|0x4209,match?20:21);h.write8((bank<<16)|0x420a,0);
 h.write8((bank<<16)|0x4200,(std::uint8_t)(oldMode<<4));
 // Advance from a real prior scanline through the scheduler. H=200 is
 // safely after the V-only edge and before H=100*4 comparator position.
 h.beginScanline(19);h.advanceCpuMasterCycles(1364-h.currentMasterCycle+200);
 if(h.io.irqPending){h.advanceCpuMasterCycles(8);h.read((bank<<16)|0x4211);}
}
int main(){
 for(unsigned bank:{0u,0x3fu,0x80u,0xbfu})for(unsigned oldMode=0;oldMode<4;oldMode++)for(bool match:{false,true}){
  auto ptr=std::make_unique<SnesRuntime>();auto&h=*ptr;prepare(h,oldMode,match,bank);
  check(!h.io.irqPending,"setup IRQ acknowledged");
  h.write8((bank<<16)|0x4200,0x20);check(!h.io.irqPending,"mode write waits for a comparator poll");h.advanceCpuMasterCycles(12);
  const bool expected=match&&oldMode!=2;
  check(h.io.irqPending==expected,"late V-only mode transition comparator edge");
  check(h.cpuIrqInterruptPending==expected,"late V-only mode transition CPU pending");
  if(expected){check(h.read((bank<<16)|0x4211)&0x80u,"late V-only TIMEUP asserted");}
  h.write8((bank<<16)|0x4200,0x20);h.advanceCpuMasterCycles(12);
  check(!h.io.irqPending,"repeated V-only write must not retrigger acknowledged match");
 }
 // Disabling then re-enabling without an intervening poll leaves the
 // comparator edge state high; allowing disabled polling rearms it.
 for(bool allowLowPoll:{false,true}){
  auto ptr=std::make_unique<SnesRuntime>();auto&h=*ptr;prepare(h,2,true,0);
  h.write8(0x4200,0);if(allowLowPoll)h.advanceCpuMasterCycles(12);
  h.write8(0x4200,0x20);h.advanceCpuMasterCycles(12);
  check(h.io.irqPending==allowLowPoll,"V-only rearm requires an intervening low comparator poll");
 }
 // Poll clipping must not make the outcome depend on scheduler batching.
 for(unsigned mode=1;mode<4;mode++){
  auto a=std::make_unique<SnesRuntime>(),b=std::make_unique<SnesRuntime>();
  prepare(*a,0,true,0);prepare(*b,0,true,0);
  a->write8(0x4200,(std::uint8_t)(mode<<4));b->write8(0x4200,(std::uint8_t)(mode<<4));
  a->advanceCpuMasterCycles(2000);for(unsigned i=0;i<2000;i++)b->advanceCpuMasterCycles(1);
  check(a->cpuMasterClock==b->cpuMasterClock&&a->currentScanline==b->currentScanline&&a->currentMasterCycle==b->currentMasterCycle,"IRQ polling batch elapsed/raster parity");
  check(a->io.irqPending==b->io.irqPending&&a->cpuIrqInterruptPending==b->cpuIrqInterruptPending&&a->irqStatusHoldUntil==b->irqStatusHoldUntil,"IRQ polling batch status/hold parity");
 }
 std::cout<<"IRQ_VONLY_ENABLE_V043667 cases="<<cases<<" failures="<<failures<<'\n';return failures?1:0;
}
