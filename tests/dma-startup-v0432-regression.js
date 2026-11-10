'use strict';
require('./fixtures/run_spc_probe_v0431')('dma-startup-v0432',String.raw`
unsigned bits(unsigned v){unsigned n=0;while(v){n+=v&1u;v>>=1;}return n;}
int main(){
 for(bool native:{false,true})for(unsigned mask:{0u,1u,0x81u,0xFFu}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.ppu.forceBlank=true;h.beginFrame();h.currentScanline=225;h.currentMasterCycle=100;h.wramRefreshAppliedThisLine=true;
  for(unsigned ch=0;ch<8;++ch){auto&d=h.dma[ch];d.a1b=0x7E;d.a1t=0x100+ch;d.das=1;d.dmap=0;d.bbad=(std::uint8_t)(0x26+ch%4);h.ram[0x100+ch]=(std::uint8_t)(11+ch);}
  auto before=h.cpuMasterClock;h.executeDma((std::uint8_t)mask);
  const auto expected=mask?8u+bits(mask)*16u:0u;
  assert(h.cpuMasterClock-before==expected&&h.dmaStallMasterCycles==expected&&h.apu.masterObserved==h.cpuMasterClock&&h.io.mdmaen==0);
  assert(h.hwUsage.dmaBytes==bits(mask));for(unsigned ch=0;ch<8;++ch)assert(h.dma[ch].das==((mask&(1u<<ch))?0:1));
 }
 // Shared setup is paid once, before the per-channel setup and payload.
 {SnesRuntime h;h.headless=true;h.ppu.forceBlank=true;h.beginFrame();h.currentScanline=225;h.currentMasterCycle=100;h.wramRefreshAppliedThisLine=true;auto&d=h.dma[0];d.a1b=0x7E;d.a1t=0x100;d.das=4;d.dmap=0;d.bbad=0x40;h.apu.tracePorts=true;for(unsigned i=0;i<4;++i)h.ram[0x100+i]=(std::uint8_t)(0x10+i);h.executeDma(1);unsigned i=0;for(const auto&e:h.apu.portEvents)if(e.side=='C'){assert(e.master==24u+8u*i&&e.value==0x10u+i);++i;}assert(i==4&&h.cpuMasterClock==48&&h.apu.spc.portIn[0]==0x13);}
 std::cout<<"DMA_STARTUP_V0432_PASS zero_mask=0 common=8mc channel=8mc byte=8mc modes=native/fallback channels=1/2/8 timestamps=24/32/40/48\n";
}
`);
