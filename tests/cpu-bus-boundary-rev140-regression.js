'use strict';
require('./fixtures/run_spc_probe_v0431')('cpu-bus-boundary-rev140',String.raw`
int main(){
 SnesRuntime h;h.headless=true;
 // $3FFF costs 6 clocks; $4000 costs 12. Code fetch must price each byte.
 h.advanceCpuInstruction(0x003fffu,2,2,SnesRuntime::NO_TIMING_ADDR,0,SnesRuntime::NO_TIMING_ADDR,0,0);
 assert(h.lastInstructionMasterCycles==18u);
 // A word data operand crosses the same speed boundary.
 h.advanceCpuInstruction(0x008000u,5,3,0x003fffu,2,SnesRuntime::NO_TIMING_ADDR,0,0);
 assert(h.lastInstructionMasterCycles==42u);
 // Fetches wrap the low PC word, preserving PB. $FFFF -> $0000.
 h.io.memsel=1;
 h.advanceCpuInstruction(0x80ffffu,2,2,SnesRuntime::NO_TIMING_ADDR,0,SnesRuntime::NO_TIMING_ADDR,0,0);
 assert(h.lastInstructionMasterCycles==14u);
 std::cout<<"CPU_BUS_BOUNDARY_REV140_PASS\n";
}
`);
