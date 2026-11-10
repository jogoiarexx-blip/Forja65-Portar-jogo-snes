#include "runtime.hpp"
#include <iostream>
#include <stdexcept>
static void check(bool ok,const char* why){if(!ok)throw std::runtime_error(why);}
int main(int argc,char**argv){try{
 const bool reverse=argc>1&&std::string(argv[1])=="reverse";unsigned vectors=0;
 for(bool native:{false,true})for(bool hdma:{false,true})for(bool indirect:{false,true})for(unsigned phase=0;phase<(reverse?8u:13u);phase++){
  if(!hdma&&indirect)continue;
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.frameTimingActive=true;h.hdmaSetupComplete=true;
  h.wramRefreshAppliedThisLine=true;h.hdmaExecutedThisLine=true;
  h.currentScanline=reverse?225u:h.visibleLines()-1u;h.ppu.vCounter=h.currentScanline;
  const unsigned overhead=hdma?SnesRuntime::DMA_SYNC_MC:16u;
  const unsigned start=reverse?100u+phase:SnesRuntime::MASTER_CYCLES_PER_SCANLINE-overhead-phase;
  h.setMasterCycle(start);h.ppu.vram[0]=0x11;h.ram[0x100]=0x5a;
  auto&d=h.dma[0];d.a1b=0x7e;d.a1t=0x100;d.a2a=0x100;d.das=hdma?0x100:1;d.dasb=0x7e;
  d.dmap=(reverse?0x80:0)|(indirect?0x40:0);d.bbad=reverse?0x37:0x18;
  if(hdma){h.hdmaActive=1;h.hdmaTransfer[0]=true;d.ntrl=2;h.hdmaLines[0]=2;h.executeHdmaLine();}
  else h.executeDma(1);
  if(reverse){
   check(h.ppu.counterLatched,"reverse DMA did not latch PPU counters");
   check(h.ppu.latchedHCounter==(start+overhead+4u)/4u,"reverse B-bus read did not occur at byte +4");
  }else{
   check(h.ppu.vram[0]==(phase<=8u?0x5a:0x11),"forward B-bus write was blocked before VBlank instead of occurring at byte +8");
   check(h.vramBlockedWrites==(phase<=8u?0u:1u),"forward B-bus write sampled stale visibility gate");
  }
  check((hdma?h.hdmaStallMasterCycles:h.dmaStallMasterCycles)==overhead+8u+(hdma?8u:0u),"payload phase changed DMA stall accounting");vectors++;
 }
 std::cout<<"DMA_PAYLOAD_PHASE_V043685_PASS direction="<<(reverse?"reverse":"forward")<<" vectors="<<vectors<<'\n';return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
