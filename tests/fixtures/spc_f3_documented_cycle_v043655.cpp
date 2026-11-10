#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <fstream>
#include <string>

static void init(ApuBridge& a,unsigned nop,bool low,unsigned page){
 a.spc.control=0;a.spc.pc=0x300;a.spc.psw=0;
 a.spc.dspAddr=0x6c;a.spc.setA(low?0x20:0x6c);
 a.spc.setY(low?0x73:0x20);
 for(unsigned i=0;i<nop;i++)a.spc.ram[0x300+i]=0; // 2-cycle NOP
 a.spc.ram[0x300+nop]=0xda; // MOVW dp,YA -- 5 cycles, not 4
 a.spc.ram[0x301+nop]=low?0xf3:0xf2;
 a.spc.ram[0x302+nop]=0xff; // STOP
 a.dsp.writeReg(0x6d,(std::uint8_t)page,a.spc.ram);
}
int main(int argc,char**argv){
 unsigned cases=0;
 // Both writing orders: dp=$F3 -> low-byte F3 on cycle 4;
 // dp=$F2 -> high-byte F3 on cycle 5, after the F2 address latch.
 for(unsigned nop=0;nop<=13;nop++)for(bool low:{false,true}){
  ApuBridge a;init(a,nop,low,0x30);
  a.tickSpcMasterCycles(672);
  assert(a.f3BusTrace.size()==1);
  const auto& ev=a.f3BusTrace.front();
  assert(ev.opcode==0xda && ev.pc==0x300+nop);
  assert(ev.instructionCycles==5);
  assert(ev.documentedWriteCycle==(low?4u:5u));
  assert(ev.totalAccesses>=ev.ordinal && ev.ordinal>=1);
  assert(ev.dspAddr==0x6c && ev.value==0x20 && ev.writeAccepted);
  assert(a.dsp.readReg(0x6c)==0x20);
  assert(a.spc.portOut[0]==(low?0x73:0x00));
  assert(a.spcExecutedCycles>=2*nop+5u);
  ++cases;
 }
 // A direct-page relocation to $01F3 must not be tagged as a DSP write.
 {ApuBridge a;init(a,0,true,0x43);a.spc.psw=0x20;
  a.tickSpcMasterCycles(110);
  assert(a.f3BusTrace.empty());++cases;}
 // Standalone instruction count without host-clock accounting.
 {ApuBridge a;init(a,0,true,0x44);
  const int c=forja65SpcStep(a);
  assert(c==5&&a.spcExecutedCycles==5&&a.f3BusTrace.size()==1);
  assert(!a.f3BusTrace[0].hasCompletion);
  assert(a.f3BusTrace[0].documentedWriteCycle==4);++cases;}
 // Test the external CSV contract and note that cycle position is a
 // reference ANNOTATION, not an actual timestamp emitted by this runtime.
 {ApuBridge a;init(a,0,true,0x45);a.tickSpcMasterCycles(110);
  assert(a.saveF3BusTrace("spc_f3_annotated55.csv"));
  std::ifstream file("spc_f3_annotated55.csv");
  std::string data((std::istreambuf_iterator<char>(file)),std::istreambuf_iterator<char>());
  assert(data.find("documented_write_cycle,timing_source")!=std::string::npos);
  assert(data.find("5,4,spc700_commands_2014_table_1_1_6d")!=std::string::npos ||
         data.find(",4,spc700_commands_2014_table_1_1_6d")!=std::string::npos);
  assert(data.find("documented_cycle_is_not_runtime_write_timestamp=1")!=std::string::npos);
  ++cases;}
 std::cout<<"SPC_F3_DOCUMENTED_CYCLE_V043655_PASS cases="<<cases<<"\n";
}
