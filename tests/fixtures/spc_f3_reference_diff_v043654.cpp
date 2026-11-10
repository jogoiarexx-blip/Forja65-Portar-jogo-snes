#include "runtime.hpp"
#include <cassert>
#include <fstream>
#include <iostream>

int main(){
  ApuBridge a;
  a.spc.control=0;
  a.spc.pc=0x300;
  a.setNativeDsp(true);
  a.dsp.hardwareEchoFir=true;
  a.spc.dspAddr=0x6c;
  a.spc.ram[0x300]=0x8f;
  a.spc.ram[0x301]=0x20;
  a.spc.ram[0x302]=0xf3;
  a.spc.ram[0x303]=0xff; // STOP, no further F3 writes
  a.tickMasterCycles(672);
  assert(a.f3BusTrace.size()==1);
  const auto&first=a.f3BusTrace.front();
  assert(first.pc==0x300&&first.opcode==0x8f&&first.dspAddr==0x6c);
  assert(first.ordinal==4&&first.totalAccesses==4&&first.instructionCycles==5);
  assert(first.value==0x20&&first.writeAccepted);
  assert(first.hasCompletion&&first.completedMaster>0);
  assert(first.instructionId==1&&first.spcCyclesEnd==5);
  // Repeat at the same PC: a sequence ID must disambiguate loop iterations.
  const auto beforeCycles=a.spcExecutedCycles;
  a.spc.stopped=false;
  a.spc.pc=0x300;
  assert(forja65SpcStep(a)==5);
  assert(a.f3BusTrace.size()==2);
  const auto&second=a.f3BusTrace[1];
  assert(second.instructionId>first.instructionId);
  assert(second.spcCyclesEnd==beforeCycles+5&&second.instructionCycles==5);
  assert(!second.hasCompletion);
  assert(a.saveF3BusTrace("observed54.csv"));
  std::ofstream expected("reference54.csv");
  expected<<"pc,opcode,dsp_addr,value,access_ordinal,logical_accesses,instruction_cycles,completion_master,accepted,instruction_id,spc_cycles_end\n";
  expected<<"768,143,108,32,4,4,5,"<<first.completedMaster<<",1,1,5\n";
  expected<<"768,143,108,32,4,4,5,unknown,1,"<<second.instructionId<<","<<second.spcCyclesEnd<<"\n";
  expected<<"# dropped=0; reference_is_logical_only=1\n";
  expected.close();
  std::cout<<"SPC_F3_REFERENCE_DIFF_V043654_PASS cases=12\n";
}
