#include "runtime.hpp"
#include <iostream>
#include <stdexcept>
#include <string>
static void require(bool c,const char* message){ if(!c)throw std::runtime_error(message); }
int main(){
 unsigned checks=0,corrected=0;
 for(bool native:{false,true})for(unsigned speed:{6u,8u})for(unsigned phase=0;phase<8;phase++)for(bool refresh:{false,true})for(unsigned len:{1u,6u,23u}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.ppu.forceBlank=true;
  h.cart.assign(0x8000,0xEA);h.cart[1]=(speed==6u?0xEAu:0xA9u); // NOP internal 6mc vs LDA operand 8mc
  h.lastInstructionPc=0x008000u;h.lastInstructionSize=1;
  h.frameTimingActive=true;h.currentScanline=225u;h.ppu.vCounter=225u;
  h.hdmaSetupComplete=true;h.hdmaExecutedThisLine=true;
  h.wramRefreshAppliedThisLine=!refresh;h.setMasterCycle(refresh?520u:700u);
  h.cpuMasterClock=phase+96u;
  for(unsigned i=0;i<len;i++)h.ram[0x100+i]=std::uint8_t(i+7u);
  auto&d=h.dma[0];d.a1b=0x7e;d.a1t=0x100;d.das=std::uint16_t(len);d.bbad=0x26;d.dmap=0;
  const auto c0=h.cpuMasterClock,md0=h.dmaStallMasterCycles,ref0=h.wramRefreshStallMasterCycles;
  h.executeDma(1);
  const auto elapsed=h.cpuMasterClock-c0, md=h.dmaStallMasterCycles-md0, rf=h.wramRefreshStallMasterCycles-ref0;
  require(h.hwUsage.dmaBytes==len&&d.das==0,"DMA byte/count mismatch");
  require(rf==(refresh?40u:0u),"Refresh crossing mismatch");
  require(elapsed==md+rf,"DMA elapsed excludes extra stalls");
  if(elapsed%speed!=0){
    std::cerr<<"ALIGN_FAIL native="<<native<<" speed="<<speed<<" phase="<<phase<<" refresh="<<refresh<<" len="<<len<<" elapsed="<<elapsed<<" md="<<md<<" refresh_mc="<<rf<<" rem="<<(elapsed%speed)<<'\n';
    return 1;
  }
  if(refresh)corrected++;
  checks++;
 }
 std::cout<<"REV215_DMA_REFRESH_ALIGNMENT_PASS vectors="<<checks<<" refresh="<<corrected<<"\n";
}
