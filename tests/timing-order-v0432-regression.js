'use strict';
// REV160: the 1132-master-clock fixture predates V=0 payloads and adaptive MDMA alignment.
// Keep its original model explicit; default-mode raster/event equivalence is tested separately.
process.env.FORJA65_HDMA_V0_TRANSFER='0';
process.env.FORJA65_DMA_SYNC='legacy';
require('./fixtures/run_spc_probe_v0431')('timing-order-v0432',String.raw`
void prepare(SnesRuntime&h,bool native){
 h.headless=true;h.nativeDmaEnabled=native;h.ppu.forceBlank=true;h.io.hdmaen=1;
 h.dma[0].a1b=0x7E;h.dma[0].a1t=0x1000;h.dma[0].dmap=0;h.dma[0].bbad=0x40;
 h.ram[0x1000]=0x81;h.ram[0x1001]=0xCC;h.ram[0x1002]=0;
 auto&s=h.apu;s.accurateSpcTiming=true;s.strictSpcScheduler=true;s.correctedSpcSemantics=true;s.ntscSpcClock=true;s.tracePorts=true;
 s.spc.control=0;s.spc.pc=0x200;
 std::uint8_t program[]={0xE4,0xF4,0xC4,0xF4,0x2F,0xFA};std::copy(std::begin(program),std::end(program),s.spc.ram.begin()+0x200);
 h.beginFrame();
}
void same(const SnesRuntime&a,const SnesRuntime&b){
 assert(a.cpuMasterClock==b.cpuMasterClock&&a.currentScanline==b.currentScanline&&a.currentMasterCycle==b.currentMasterCycle);
 assert(a.apu.masterObserved==a.cpuMasterClock&&b.apu.masterObserved==b.cpuMasterClock);
 assert(a.apu.spc.pc==b.apu.spc.pc&&a.apu.spc.ya==b.apu.spc.ya&&a.apu.spc.psw==b.apu.spc.psw);
 assert(a.apu.spcExecutedCycles==b.apu.spcExecutedCycles&&a.apu.ntscCycleCredit==b.apu.ntscCycleCredit);
 assert(a.apu.spc.portIn[0]==b.apu.spc.portIn[0]&&a.apu.spc.portOut[0]==b.apu.spc.portOut[0]);
 assert(a.dma[0].a2a==b.dma[0].a2a&&a.hdmaLines[0]==b.hdmaLines[0]&&a.hdmaActive==b.hdmaActive);
 assert(a.hdmaStallMasterCycles==b.hdmaStallMasterCycles&&a.wramRefreshStallMasterCycles==b.wramRefreshStallMasterCycles);
}
int main(){
 for(bool native:{false,true}){
  SnesRuntime batch,one,irregular;prepare(batch,native);prepare(one,native);prepare(irregular,native);
  batch.advanceCpuMasterCycles(1600);for(unsigned n=0;n<1600;++n)one.advanceCpuMasterCycles(1);
  unsigned left=1600,seq=0;while(left){auto n=std::min(left,1u+((seq++*37u)%251u));irregular.advanceCpuMasterCycles(n);left-=n;}
  assert(one.apu.spc.portOut[0]==0xCC);same(batch,one);same(batch,irregular);
  // Initial descriptor is prefetched at setup; first B-bus payload has no
  // lazy table-read delay. B-bus write occurs at payload +8, not byte start.
  // Global synchronization remains this runtime model.
  unsigned found=0;for(const auto&e:batch.apu.portEvents)if(e.side=='C'&&e.port==0&&e.value==0xCC){assert(e.master==1132);++found;}assert(found==1);
  assert(batch.cpuMasterClock==1700&&batch.lastInstructionMasterCycles==1700);
  const auto before=batch.cpuMasterClock;batch.advanceCpuMasterCycles(0);assert(batch.cpuMasterClock==before);
 }
 // MDMA bytes crossing the HDMA event preserve that event's model timestamp.
 for(bool native:{false,true}){SnesRuntime h;prepare(h,native);h.dma[1]=h.dma[0];h.startHdmaFrame(2);auto&d=h.dma[0];d={};d.a1b=0x7E;d.a1t=0x2000;d.das=200;d.dmap=0;d.bbad=0x26;for(unsigned i=0;i<200;++i)h.ram[0x2000+i]=(std::uint8_t)i;h.executeDma(1);assert(h.cpuMasterClock==1716&&h.dmaStallMasterCycles==1616&&h.hdmaStallMasterCycles==60&&h.wramRefreshStallMasterCycles==40&&h.hwUsage.dmaBytes==200&&h.hwUsage.hdmaBytes==1&&h.apu.spc.portOut[0]==0xCC);unsigned found=0;for(const auto&e:h.apu.portEvents)if(e.side=='C'&&e.value==0xCC){assert(e.master==1132);++found;}assert(found==1);}
 // Long advances must retain event order across line and frame boundaries.
 {SnesRuntime a,b;prepare(a,false);prepare(b,false);a.advanceCpuMasterCycles(400000);unsigned left=400000;while(left){const auto n=std::min(left,997u);b.advanceCpuMasterCycles(n);left-=n;}same(a,b);assert(a.frameCounter==b.frameCounter&&a.frameCounter>0&&a.io.vblank==b.io.vblank);}
 std::cout<<"TIMING_ORDER_V0432_PASS CPU/APU/HDMA batch=one_clock=irregular native/fallback trace=1132mc frames=consistent MDMA_overlap=200bytes no_stall_doublecount\n";
}
`);
