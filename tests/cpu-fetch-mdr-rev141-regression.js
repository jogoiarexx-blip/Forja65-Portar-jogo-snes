'use strict';
// Removing the fetch from advanceCpuInstruction must fail the first assertion.
require('./fixtures/run_spc_probe_v0431')('cpu-fetch-mdr-rev141',String.raw`
int main(){
 SnesRuntime h;h.headless=true;h.mapper=MapperKind::HiROM;
 h.cart.resize(0x10000,0xea);h.romLogicalSize=h.cart.size();
 h.busClockTrace.start("fetch-clock.csv",100);
 h.trace.start("fetch-events.csv","fixture",100);
 h.cart[0x8000]=0xdd;h.cart[0x8001]=0x00;h.cart[0x8002]=0x60;
 h.write8(0x307f00,0x00);
 h.advanceCpuInstruction(0xc08000,4,3,0x307f00,1,SnesRuntime::NO_TIMING_ADDR,0,0);
 assert(h.read(0x307f00)==0x60 && "unmapped operand must see final instruction byte, not last STA value");
 assert(h.lastInstructionMasterCycles==32);
 h.write8(0x307f00,0xf0);
 h.advanceCpuInstruction(0xc08000,4,3,0x307f00,1,SnesRuntime::NO_TIMING_ADDR,0,0);
 assert(h.read(0x307f00)==0x60);
 // PB wrap, no crossing into C1. Final operand comes from C0:0000.
 h.cart[0xffff]=0xa9;h.cart[0]=0x42;h.cpuDataBus=0x99;
 h.advanceCpuInstruction(0xc0ffff,2,2,SnesRuntime::NO_TIMING_ADDR,0,SnesRuntime::NO_TIMING_ADDR,0,0);
 assert(h.cpuDataBus==0x42);
 // Executable WRAM must drive live bytes, including mutation.
 h.ram[0x100]=0xa9;h.ram[0x101]=0x73;
 h.advanceCpuInstruction(0x7e0100,2,2,SnesRuntime::NO_TIMING_ADDR,0,SnesRuntime::NO_TIMING_ADDR,0,0);
 assert(h.cpuDataBus==0x73);
 h.ram[0x101]=0x28;
 h.advanceCpuInstruction(0x7e0100,2,2,SnesRuntime::NO_TIMING_ADDR,0,SnesRuntime::NO_TIMING_ADDR,0,0);
 assert(h.cpuDataBus==0x28);
 // Fetch must work in native-ROM-only mode too.
 NativeRomRegion reg;reg.off=0x8000;reg.data={0xad,0x00,0x60};
 h.nativeRom.logicalSize=0x10000;h.nativeRom.regions.push_back(reg);h.cart.clear();
 h.advanceCpuInstruction(0xc08000,4,3,0x306000,1,SnesRuntime::NO_TIMING_ADDR,0,0);
 assert(h.read(0x306000)==0x60);
 h.cpuDataBus=0xaa;h.io.quotient=0x55;h.readCpuInstructionByte(0x004214);
 assert(h.cpuDataBus==0xaa); // S-CPU internal MMIO does not drive MDR.
 h.busClockTrace.close();h.trace.close();
 std::ifstream tf("fetch-events.csv");std::string line;unsigned fetches=0;
 while(std::getline(tf,line))if(line.find(",fetch,")!=std::string::npos)fetches++;
 assert(fetches==16u);
 std::ifstream clock("fetch-clock.csv");unsigned clockFetches=0;
 while(std::getline(clock,line))if(line.find(",fetch,")!=std::string::npos){
  assert(line.size()>=6 && line.substr(line.size()-6)==",false");clockFetches++;
 }
 assert(clockFetches==16u);
 std::cout<<"CPU_FETCH_MDR_REV141_PASS open-bus rom/wram/mutation/pb-wrap/native-pack unchanged-timing\n";
}
`);
