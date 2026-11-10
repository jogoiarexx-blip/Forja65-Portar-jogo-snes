#include "runtime.hpp"
#include <cstdint>
#include <iostream>
static unsigned checks=0, failures=0;
static void check(bool p,const char*msg){++checks;if(!p){++failures;std::cerr<<"FAIL "<<msg<<"\n";}}
int main(){
 for(bool native:{false,true}){
  // A DMA started just before HBlank on a channel used by indirect HDMA.
  // $43x5/6 is BOTH the DMA count and the indirect HDMA pointer. After
  // arbitration, DMA cleanup must not clobber the HDMA-owned pointer.
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;
  h.ppu.forceBlank=true;h.beginFrame();
  h.currentScanline=5;h.setMasterCycle(1070);
  h.wramRefreshAppliedThisLine=true;h.hdmaSetupComplete=true;
  h.hdmaActive=1;h.hdmaEnded=0;h.hdmaTransfer[0]=true;h.hdmaLines[0]=2;
  h.hdmaExecutedThisLine=false;
  auto&d=h.dma[0];d.dmap=0x40;d.bbad=0x26;d.a1b=0x7e;
  d.a1t=0x400;d.dasb=0x7e;d.das=0x0050;d.a2a=0x300;d.ntrl=0x83;
  h.ram[0x300]=0x82;
  h.ram[0x50]=0x6a;h.ram[0x51]=0x6b;
  for(unsigned k=0;k<0x100;k++)h.ram[0x400+k]=0x22;
  h.executeDma(1);
  check(h.hdmaExecutedThisLine,"HBlank HDMA occurred during MDMA");
  check(h.hwUsage.hdmaBytes==1,"one indirect HDMA byte transferred");
  check(h.hwUsage.dmaBytes>0&&h.hwUsage.dmaBytes<0x50,"same-channel MDMA preempted");
  check(h.dma[0].das==0x51,"HDMA-owned indirect pointer survives MDMA cleanup");
  // Allow the in-flight MDMA byte to finish writing on the same PPU port.
  // After arbitration, the following line must continue from the HDMA pointer.
  h.executeHdmaLine();
  check(h.ppu.wh[0]==0x6b,"next HDMA line reads the correct indirect byte");
  check(d.das==0x52,"following HDMA line advances indirect pointer");
 }
 std::cout<<"DMA_HDMA_INDIRECT_DAS_REV124 checks="<<checks<<" failures="<<failures<<"\n";
 return failures?1:0;
}
