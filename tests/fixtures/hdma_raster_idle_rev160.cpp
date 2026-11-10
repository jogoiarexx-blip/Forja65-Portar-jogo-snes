#include <cstdint>
static std::uint64_t rev160Steps{};
#include "runtime.hpp"
#include <cassert>
#include <iostream>
#ifdef _WIN32
static void flag(const char*k,const char*v){_putenv_s(k,v);}
#else
static void flag(const char*k,const char*v){setenv(k,v,1);}
#endif
static void same(const SnesRuntime&a,const SnesRuntime&b){
 assert(a.cpuMasterClock==b.cpuMasterClock&&a.currentScanline==b.currentScanline&&a.currentMasterCycle==b.currentMasterCycle);
 assert(a.lastInstructionMasterCycles==b.lastInstructionMasterCycles);
 assert(a.io.irqPending==b.io.irqPending&&a.io.nmiPending==b.io.nmiPending);
 assert(a.ppu.vCounter==b.ppu.vCounter&&a.ppu.hCounter==b.ppu.hCounter);
 assert(a.frameCounter==b.frameCounter&&a.hdmaExecutedThisLine==b.hdmaExecutedThisLine);
 assert(a.hdmaActive==b.hdmaActive&&a.hdmaEnded==b.hdmaEnded&&a.hdmaSetupComplete==b.hdmaSetupComplete);
 assert(a.hdmaStallMasterCycles==b.hdmaStallMasterCycles&&a.wramRefreshStallMasterCycles==b.wramRefreshStallMasterCycles);
 assert(a.apu.masterObserved==b.apu.masterObserved&&a.apu.spc.pc==b.apu.spc.pc);
 assert(a.hwUsage.hdmaBytes==b.hwUsage.hdmaBytes&&a.hwUsage.wramReads==b.hwUsage.wramReads);
 assert(a.framebufferHash()==b.framebufferHash()&&a.ramHash()==b.ramHash());
 for(unsigned i=0;i<8;i++){
  assert(a.dma[i].a2a==b.dma[i].a2a&&a.dma[i].das==b.dma[i].das&&a.dma[i].ntrl==b.dma[i].ntrl);
  assert(a.hdmaLines[i]==b.hdmaLines[i]&&a.hdmaTransfer[i]==b.hdmaTransfer[i]);
 }
}
static void init(SnesRuntime&h,bool native,unsigned mask,unsigned region){
 h.headless=true;h.nativeDmaEnabled=native;h.regionCode=region;h.ppu.brightness=15;h.ppu.forceBlank=false;
 h.ppu.cgram[0]=31;h.ppu.cgram[1]=0;h.io.hdmaen=(std::uint8_t)mask;
 for(unsigned ch=0;ch<8;ch++){
  auto&d=h.dma[ch];d.dmap=0;d.bbad=0;d.a1b=0x7e;d.a1t=(std::uint16_t)(0x100+ch*8);
  h.ram[d.a1t]=0x83;h.ram[d.a1t+1]=8;h.ram[d.a1t+2]=4;h.ram[d.a1t+3]=15;h.ram[d.a1t+4]=0;
 }
 h.beginFrame();
}
int main(){
 unsigned cases=0;std::uint64_t totalSaved=0;
 const char*setting=std::getenv("FORJA65_HDMA_V0_TRANSFER");
 const bool v0=!setting||std::string(setting)!="0";
 for(unsigned region:{1u,2u})for(unsigned chunk:{1u,7u,127u,4096u}){
  flag("FORJA65_HDMA_IDLE_SKIP","0");SnesRuntime ref;init(ref,false,0,region);
  flag("FORJA65_HDMA_IDLE_SKIP","1");SnesRuntime fast;init(fast,false,0,region);
  const auto run=[&](SnesRuntime&h){rev160Steps=0;unsigned left=1364u*8u;while(left){unsigned n=std::min(left,chunk);h.advanceCpuMasterCycles(n);left-=n;}return rev160Steps;};
  const auto a=run(ref),b=run(fast);same(ref,fast);assert(b<=a);if(chunk==4096)assert(b<a);totalSaved+=a-b;cases++;
 }
 for(unsigned region:{1u,2u})for(bool native:{false,true})for(unsigned mask:{0u,1u,0x55u,0xffu}){
  flag("FORJA65_HDMA_IDLE_SKIP","0");SnesRuntime ref;init(ref,native,mask,region);
  flag("FORJA65_HDMA_IDLE_SKIP","1");SnesRuntime fast;init(fast,native,mask,region);
  for(unsigned n:{11u,1u,93u,440u,16384u}){ref.advanceCpuMasterCycles(n);fast.advanceCpuMasterCycles(n);same(ref,fast);
   if(n==1){unsigned count=0;for(unsigned b=0;b<8;b++)count+=(mask>>b)&1u;assert(ref.hwUsage.hdmaBytes==(v0?count:0u));}
   cases++;}
 }
 // Enable just before, exactly at, and after the HBlank event. No missed
 // early event and no fabricated late event are allowed.
 for(unsigned at:{1104u,1106u,1108u})for(bool native:{false,true}){
  flag("FORJA65_HDMA_IDLE_SKIP","0");SnesRuntime ref;init(ref,native,0,1);
  flag("FORJA65_HDMA_IDLE_SKIP","1");SnesRuntime fast;init(fast,native,0,1);
  for(auto*h:{&ref,&fast}){
   h->currentScanline=10;h->currentMasterCycle=1096;h->wramRefreshAppliedThisLine=true;
   h->hdmaExecutedThisLine=false;h->hdmaSetupComplete=true;
   h->advanceCpuMasterCycles(at-1096u);
   h->dma[0].a2a=0x101;h->dma[0].ntrl=0x83;h->hdmaLines[0]=3;h->hdmaTransfer[0]=true;
   h->setHdmaEnable(1);h->advanceCpuMasterCycles(6);
  }
  same(ref,fast);assert(ref.hwUsage.hdmaBytes==(at<SnesRuntime::HDMA_START_MC?1u:0u));cases++;
 }
 // Frame rollovers must preserve clocks and PPU/APU state even when one
 // call spans the entire frame and the full-poll reference stops at idle edges.
 for(unsigned region:{1u,2u}){
  flag("FORJA65_HDMA_IDLE_SKIP","0");SnesRuntime ref;init(ref,false,0,region);
  flag("FORJA65_HDMA_IDLE_SKIP","1");SnesRuntime fast;init(fast,false,0,region);
  const unsigned budget=1364u*(region==1?262u:312u)*2u;
  ref.advanceCpuMasterCycles(budget);unsigned left=budget;
  while(left){const auto n=std::min(left,11357u);fast.advanceCpuMasterCycles(n);left-=n;}
  same(ref,fast);assert(ref.frameCounter>=2);cases++;
 }
 // Modern V=0 changes the first visible line, whereas setup-only leaves
 // the initial brightness in place. Both profiles must keep their raster.
 {
  flag("FORJA65_HDMA_IDLE_SKIP","1");SnesRuntime h;init(h,false,1,1);
  h.advanceCpuMasterCycles(100);assert(h.ppu.brightness==(v0?8u:15u));
  h.renderVisibleUntilMasterCycle(0,h.currentMasterCycle);
  const auto row0=h.ppu.rgba15(31);assert(h.framebuffer[0]==row0);
  h.advanceCpuMasterCycles(1364u-h.currentMasterCycle);
  assert(h.currentScanline==1);assert(h.ppu.brightness==(v0?4u:8u));
  h.renderVisibleUntilMasterCycle(1,h.currentMasterCycle);
  assert(h.framebuffer[0]==row0);assert(h.framebuffer[h.fbWidth]==h.ppu.rgba15(31));cases++;
 }
 assert(totalSaved>0);
 std::cout<<"HDMA_RASTER_REV160_PASS cases="<<cases<<" idle_scheduler_steps_saved="<<totalSaved<<"\n";
}
