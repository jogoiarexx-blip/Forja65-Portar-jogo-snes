'use strict';
// REV143: o padrao do SPC700 passou a 1.025.280 Hz (REV138 reintegrado). Este teste mede a aritmetica
// fracionaria do agendador no relogio nominal; fixa FORJA65_SPC_HZ=1024000.
process.env.FORJA65_SPC_HZ='1024000';
require('./fixtures/run_spc_probe_v0431')('clock-region-rev140',String.raw`
int main(){
 {SnesRuntime h;h.beginFrame();h.regionCode=2;h.advanceCpuMasterCycles(100);assert(h.apu.masterClockHz==21281370ull);}
 for(bool pal:{false,true}){
  ApuBridge a,b;a.setClockRegion(pal);b.setClockRegion(pal);
  a.accurateSpcTiming=b.accurateSpcTiming=true;a.ntscSpcClock=b.ntscSpcClock=true;
  a.strictSpcScheduler=b.strictSpcScheduler=true;a.interleaveSpcDsp=b.interleaveSpcDsp=true;
  a.spc.control=b.spc.control=0;a.spc.pc=b.spc.pc=0x200;
  a.spc.ram[0x200]=b.spc.ram[0x200]=0x2f;a.spc.ram[0x201]=b.spc.ram[0x201]=0xfe;
  const unsigned hz=pal?21281370u:21477272u;
  assert(a.masterClockHz==hz);
  a.tickMasterCycles(hz);unsigned left=hz;while(left){const auto n=std::min(left,997u);b.tickMasterCycles(n);left-=n;}
  assert(a.spcExecutedCycles==1024000u&&a.ntscCycleCredit==0);
  assert(a.spcExecutedCycles==b.spcExecutedCycles&&a.ntscCycleCredit==b.ntscCycleCredit);
  assert(a.dspSampleOrdinal==b.dspSampleOrdinal&&a.dspSampleOrdinal==32000);
 }
 std::cout<<"CLOCK_REGION_REV140_PASS\n";
}
`);
