#include "runtime.hpp"
#include <cstdint>
#include <iostream>
static unsigned checks=0, failures=0;
static void expect(bool good,const char*message){checks++;if(!good){failures++;std::cerr<<"FAIL: "<<message<<'\n';}}
static void prepare(SnesRuntime&h,unsigned hdmaChannel,unsigned dmaChannel){
 h.headless=true;h.nativeDmaEnabled=true;h.ppu.forceBlank=true;
 h.io.hdmaen=std::uint8_t(1u<<hdmaChannel);
 auto&hd=h.dma[hdmaChannel];hd.a1b=0x7e;hd.a1t=0x300;hd.bbad=0x26;hd.dmap=0;
 h.ram[0x300]=0x81;h.ram[0x301]=0x5A;h.ram[0x302]=0x81;h.ram[0x303]=0x5B;
 auto&dm=h.dma[dmaChannel];dm.a1b=0x7e;dm.a1t=0x400;dm.das=48;dm.bbad=0x27;dm.dmap=0;
 for(unsigned i=0;i<48;i++)h.ram[0x400+i]=std::uint8_t(0x10u+i);
}
int main(){
 // MDMA beginning during the frame setup event must lose the channel
 // claimed by HDMA. The unrelated MDMA channel must remain runnable.
 for(bool native:{false,true}){
  SnesRuntime h;prepare(h,0,0);h.nativeDmaEnabled=native;
  const auto start=h.dma[0].a1t;
  h.beginFrame();h.executeDma(1);
  expect(h.hdmaSetupComplete,"H12 setup fired during MDMA");
  expect(h.hwUsage.dmaBytes==0,"HDMA setup preempts same-channel MDMA before payload");
  expect(h.dma[0].a1t==start,"suppressed DMA does not advance source address");
  expect(h.dma[0].das==48,"suppressed DMA leaves untouched transfer size");
  expect(h.hdmaActive==1,"HDMA setup remains active after preemption");
 }
 // Collision in HBlank: only bytes before HDMA arbitration may transfer.
 for(bool native:{false,true}){
  SnesRuntime h;prepare(h,0,0);h.nativeDmaEnabled=native;
  h.beginFrame();h.currentScanline=5;h.setMasterCycle(1070);
  h.hdmaSetupComplete=true;h.hdmaActive=1;h.hdmaEnded=0;
  h.hdmaTransfer[0]=true;h.hdmaLines[0]=2;h.dma[0].ntrl=0x82;h.dma[0].a2a=0x301;
  h.wramRefreshAppliedThisLine=true;h.hdmaExecutedThisLine=false;
  h.executeDma(1);
  expect(h.hdmaExecutedThisLine,"HBlank arbitration fires inside MDMA byte loop");
  expect(h.hwUsage.hdmaBytes>=1,"HDMA still transfers its payload");
  expect(h.hwUsage.dmaBytes>=1&&h.hwUsage.dmaBytes<48,"same-channel MDMA stops at HDMA event");
  expect(h.dma[0].das>0&&h.dma[0].das<48,"remaining MDMA size retained on interruption");
  expect(h.dma[0].a1t==std::uint16_t(0x400+h.hwUsage.dmaBytes),"interrupted MDMA source matches completed bytes");
 }
 // HDMA channel 0 must not stop MDMA on channel 1, including when an
 // earlier configured DMA channel is preempted in a multi-channel request.
 for(bool native:{false,true}){
  SnesRuntime h;prepare(h,0,1);h.nativeDmaEnabled=native;
  h.beginFrame();h.executeDma(2);
  expect(h.hdmaSetupComplete,"HDMA setup still occurs with disjoint DMA channels");
  expect(h.hwUsage.dmaBytes==48,"other-channel MDMA continues after setup");
  expect(h.dma[1].das==0&&h.dma[1].a1t==0x430,"other-channel DMA source/size update");
  SnesRuntime multi;prepare(multi,0,1);multi.nativeDmaEnabled=native;
  auto&d=multi.dma[0];d.a1b=0x7e;d.a1t=0x600;d.das=32;d.bbad=0x28;
  for(unsigned i=0;i<32;i++)multi.ram[0x600+i]=std::uint8_t(i);
  multi.beginFrame();multi.executeDma(3);
  expect(multi.hwUsage.dmaBytes==48,"one cancelled channel does not cancel following MDMA channel");
  expect(multi.dma[0].das==32&&multi.dma[1].das==0,"per-channel cancel mask preserves other MDMA channel");
 }
 std::cout<<"DMA_HDMA_PREEMPTION_REV123 checks="<<checks<<" failures="<<failures<<'\n';
 return failures?1:0;
}
