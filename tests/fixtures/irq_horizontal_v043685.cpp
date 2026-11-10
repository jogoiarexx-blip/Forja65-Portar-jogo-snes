#include "runtime.hpp"
#include <iostream>
static unsigned checks{},failures{};
static void check(bool ok,const char*message){checks++;if(!ok){if(failures<16)std::cerr<<message<<'\n';failures++;}}
static void setup(SnesRuntime&h,unsigned line=10){
 h.headless=true;h.beginFrame();h.hdmaSetupComplete=true;h.currentScanline=line;h.currentMasterCycle=0;h.wramRefreshAppliedThisLine=true;h.hdmaExecutedThisLine=true;h.io.hdmaen=0;h.hdmaActive=0;
}
// Trigger formula documented in timing.txt by Anomie and independently used
// by Forja's prior common-target model. Late targets carry into the next line;
// HTIME >=340 cannot match the horizontal counter, never clamp to last clock.
static unsigned trigger(unsigned h){return h==0?10u:14u+h*4u+(h>322?2u:0u)+(h>326?2u:0u);}
int main(){
 for(unsigned region:{0u,2u})for(unsigned mode:{0x10u,0x30u})for(unsigned target=0;target<512;target++){
  SnesRuntime h;setup(h);h.regionCode=region;h.write8(0x4207,target&255);h.write8(0x4208,target>>8);h.write8(0x4209,10);h.write8(0x420a,0);h.write8(0x4200,mode);
  const unsigned event=target<340?((mode==0x10u)?trigger(target)%1364u:trigger(target)):1400u;
  if(target<340){
   h.advanceCpuMasterCycles(event-1u);check(!h.io.irqPending,"horizontal IRQ fired before its target");
   h.advanceCpuMasterCycles(1);check(h.io.irqPending&&h.cpuIrqInterruptPending,"horizontal IRQ missing at target/carry");
   check(h.currentScanline==10u+event/1364u&&h.currentMasterCycle==event%1364u,"trigger location changed clock/raster");
  }else{
   h.advanceCpuMasterCycles(1400);check(!h.io.irqPending&&!h.cpuIrqInterruptPending,"unreachable HTIME generated IRQ");
   check(h.irqEventMasterCycle(10)<0,"helper retained unreachable HTIME");
  }
 }
 // Two distinct rising comparisons in one line must work after TIMEUP ack:
 // reprogramming HTIME must not be suppressed by a per-line fired flag.
 for(unsigned mode:{0x10u,0x30u}){
  SnesRuntime h;setup(h);h.write8(0x4209,10);h.write8(0x4207,10);h.write8(0x4200,mode);
  h.advanceCpuMasterCycles(60);check(h.io.irqPending,"first horizontal IRQ missing");h.read(0x4211);check(!h.io.irqPending,"first TIMEUP ack failed");
  h.write8(0x4207,30);h.advanceCpuMasterCycles(73);check(!h.io.irqPending,"reprogrammed IRQ was early");h.advanceCpuMasterCycles(1);check(h.io.irqPending,"second horizontal compare suppressed in same line");
 }
 // Enabling H/HV within the comparator window is visible on the next sample.
 for(unsigned mode:{0x10u,0x30u}){
  SnesRuntime h;setup(h);h.write8(0x4209,10);h.write8(0x4207,10);h.advanceCpuMasterCycles(54);h.write8(0x4200,mode);h.advanceCpuMasterCycles(2);
  check(!h.io.irqPending,"late enable fired between comparator samples");h.advanceCpuMasterCycles(2);check(!h.io.irqPending,"late enable past window incorrectly triggered");
  // Use the start of a wider non-phase-aligned window (HTIME323 ->1308).
  SnesRuntime k;setup(k);k.write8(0x4209,10);k.write8(0x4207,323&255);k.write8(0x4208,323>>8);k.advanceCpuMasterCycles(1308);k.write8(0x4200,mode);k.advanceCpuMasterCycles(2);check(k.io.irqPending,"H comparator edge after late enable missing");
 }
 // Last-field-dot exclusion: at line0/MC6 both delayed(6) counters
 // are zero. H338 is suppressed; neighboring carried targets still work.
 for(unsigned region:{0u,2u})for(unsigned mode:{0x10u,0x30u})for(unsigned target:{337u,338u,339u}){
  const unsigned last=region==2u?311u:261u;
  SnesRuntime h;setup(h,last);h.regionCode=region;h.currentMasterCycle=1000;
  h.write8(0x4207,target&255);h.write8(0x4208,target>>8);
  h.write8(0x4209,last&255);h.write8(0x420a,last>>8);h.write8(0x4200,mode);
  h.advanceCpuMasterCycles(364);check(h.currentScanline==0&&!h.io.irqPending,"frame wrap setup/carried IRQ early");
  const unsigned event=trigger(target)%1364u;
  h.advanceCpuMasterCycles(event-1);check(!h.io.irqPending,"frame wrap IRQ early");
  h.advanceCpuMasterCycles(1);check(h.io.irqPending==(target!=338u),"last-field-dot suppression / adjacent target");
  if(target==338u){h.advanceCpuMasterCycles(8);check(!h.io.irqPending,"suppressed last-field comparison retriggered");}
 }
 std::cout<<"IRQ_HORIZONTAL_V043685 checks="<<checks<<" failures="<<failures<<'\n';return failures?1:0;
}
