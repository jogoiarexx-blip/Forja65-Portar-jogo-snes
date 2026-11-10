#include "runtime.hpp"
#include <iostream>
static unsigned cases=0,failures=0;
static void check(bool ok,const char*what){++cases;if(!ok){++failures;if(failures<12)std::cerr<<what<<"\n";}}
static void position(SnesRuntime&h){h.frameTimingActive=true;h.currentScanline=225;h.currentMasterCycle=100;}
int main(){
 for(bool native:{false,true})for(bool indirect:{false,true})for(unsigned channels:{1u,3u,8u})for(bool transfer:{false,true}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.ppu.forceBlank=true;position(h);
  h.hdmaActive=(std::uint8_t)((1u<<channels)-1);
  for(unsigned ch=0;ch<channels;ch++){auto&d=h.dma[ch];d.dmap=indirect?0x40:0;d.bbad=0x26;d.a1b=d.dasb=0x7e;d.a2a=d.das=(std::uint16_t)(0x100+ch*8);h.ram[d.a2a]=0x4a;d.ntrl=4;h.hdmaLines[ch]=4;h.hdmaTransfer[ch]=transfer;}
  const auto start=h.cpuMasterClock,stall=h.hdmaStallMasterCycles,reads=h.hwUsage.wramReads;
  h.executeHdmaLine();const auto expected=SnesRuntime::DMA_SYNC_MC+channels*(8u+(transfer?8u:0u));
  check(h.cpuMasterClock-start==expected,"HDMA active channel overhead including no-transfer lines");
  check(h.hdmaStallMasterCycles-stall==expected,"HDMA stall accounting matches elapsed master clocks");
  check(h.hwUsage.wramReads-reads==channels*(1u+(transfer?1u:0u)),"HDMA reads table byte on each active channel even without reload");
 }
 for(bool native:{false,true})for(unsigned mode=0;mode<8;mode++){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.ppu.forceBlank=true;position(h);h.hdmaActive=1;
  auto&d=h.dma[0];d.dmap=(std::uint8_t)(0x40|mode);d.bbad=0x26;d.a1b=d.dasb=0x7e;d.a2a=0x100;h.ram[0x100]=2;h.ram[0x101]=0;h.ram[0x102]=2;
  d.a1t=0x100;h.io.hdmaen=1;h.beginFrame();const auto setupStart=h.cpuMasterClock;h.advanceCpuMasterCycles(12u+(unsigned)(h.cpuMasterClock&7u));
  check(h.cpuMasterClock-setupStart==12+SnesRuntime::DMA_SYNC_MC+8+16,"HDMA indirect descriptor pointer reads cost sixteen clocks at setup");
  position(h);std::size_t length=0;h.dmaPattern((std::uint8_t)mode,length);const auto start=h.cpuMasterClock;
  h.executeHdmaLine();check(h.cpuMasterClock-start==SnesRuntime::DMA_SYNC_MC+8+length*8,"HDMA line uses indirect pointer already read at setup");
  check(d.a2a==0x103&&d.das==0x200+length,"HDMA indirect pointer and transfer progression");
 }
 // Initial descriptor fetch uses the DMA A-bus decoder, with no PPU read side effect.
 for(bool native:{false,true})for(bool indirect:{false,true})for(unsigned bank:{0u,0x3fu,0x80u,0xbfu}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.ppu.forceBlank=true;position(h);h.hdmaActive=1;
  auto&d=h.dma[0];d.dmap=indirect?0x40:0;d.bbad=0x26;d.a1b=(std::uint8_t)bank;d.a1t=0x2138;
  h.ppu.oamAddr=0;h.ppu.oamFlip=false;h.ppu.oam[0]=2;
  h.io.hdmaen=1;h.beginFrame();const auto start=h.cpuMasterClock;h.advanceCpuMasterCycles(12u+(unsigned)(h.cpuMasterClock&7u));
  check(h.hdmaActive==0&&h.hdmaEnded==1&&d.a2a==(indirect?0x213a:0x2139),"HDMA inaccessible descriptor supplies zero terminator");
  check(h.ppu.oamAddr==0&&!h.ppu.oamFlip,"HDMA descriptor read cannot invoke PPU port");
  check(h.cpuMasterClock-start==12+SnesRuntime::DMA_SYNC_MC+8+(indirect?8u:0u),"HDMA terminating descriptor still costs channel table-read clocks");
 }
 // Terminal indirect channels perform a partial or full pointer fetch.
 for(bool native:{false,true})for(unsigned ch=0;ch<8;ch++)for(bool later:{false,true}){
  if(later&&ch==7)continue;
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.ppu.forceBlank=true;position(h);
  h.hdmaActive=(std::uint8_t)((1u<<ch)|(later?(1u<<(ch+1)):0));
  auto&d=h.dma[ch];d.dmap=0x40;d.a1b=0x7e;d.a2a=0x100;d.das=0x9876;d.ntrl=1;h.hdmaLines[ch]=1;h.hdmaTransfer[ch]=false;
  h.ram[0x100]=0;h.ram[0x101]=0x34;h.ram[0x102]=0x12;
  if(later){h.dma[ch+1].a1b=0x7e;h.dma[ch+1].a2a=0x200;h.dma[ch+1].ntrl=3;h.hdmaLines[ch+1]=3;h.hdmaTransfer[ch+1]=false;}
  const auto start=h.cpuMasterClock;h.executeHdmaLine();
  check(d.ntrl==0,"terminal descriptor sets visible NTRL to zero");
  check(d.a2a==(later?0x103:0x102),"terminal indirect pointer fetch length depends on later active channel");
  check(d.das==(later?0x1234:0x3400),"terminal indirect pointer retains partial high-byte result");
  check(h.cpuMasterClock-start==SnesRuntime::DMA_SYNC_MC+(later?32u:16u),"terminal indirect pointer reads account exact clocks");
 }
 // Steady-state HDMA transfers all eight channels before table reads.
 // The late channels must not be delayed into the next visible scanline.
 for(bool native:{false,true}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.beginFrame();
  h.currentScanline=10;h.currentMasterCycle=1106;h.wramRefreshAppliedThisLine=true;h.hdmaExecutedThisLine=true;h.apu.tracePorts=true;h.hdmaActive=255;
  for(unsigned ch=0;ch<8;ch++){
   auto&d=h.dma[ch];d.dmap=0x44;d.bbad=0x40;d.a1b=d.dasb=0x7e;d.a2a=(std::uint16_t)(0x100+ch);d.das=(std::uint16_t)(0x200+ch*4);
   h.ram[d.a2a]=(std::uint8_t)(0xa0+ch);for(unsigned i=0;i<4;i++)h.ram[d.das+i]=(std::uint8_t)(0x10+ch);
   d.ntrl=4;h.hdmaLines[ch]=4;h.hdmaTransfer[ch]=true;
  }
  const auto start=h.cpuMasterClock;h.executeHdmaLine();unsigned channel=0;
  for(const auto&e:h.apu.portEvents)if(e.side=='C'&&e.port==0){
   check(e.master-start==26u+32u*channel,"all HDMA payload channels precede any table-read overhead");
   if(channel==6)check(1106u+(unsigned)(e.master-start)==1324u,"channel six first B-bus write occurs before scanline boundary");
   channel++;
  }
  check(channel==8,"eight channel B-bus write events observed");
  check(h.cpuDataBus==0xa7,"final HDMA MDR comes from final table read rather than payload");
  check(h.cpuMasterClock-start==338,"HDMA phase correction preserves total channel cost");
 }
 std::cout<<"HDMA_BUS_COST_V043666_VIDEO cases="<<cases<<" failures="<<failures<<"\n";return failures?1:0;
}
