#include "runtime.hpp"
#include <cassert>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>

static void setup(ApuBridge& s){
 s.spc.control=0; s.spc.pc=0x300; s.setNativeDsp(true); s.dsp.hardwareEchoFir=true;
 s.spc.dspAddr=0x6c; s.dsp.writeReg(0x6c,0,s.spc.ram);
}
static std::string readText(const std::string& p){std::ifstream f(p);return {std::istreambuf_iterator<char>(f),{}};}
int main(){
 unsigned cases=0;
 // MOV dp,#imm performs 4 logical interpreter bus accesses (opcode, imm, dp)
 for(unsigned i=0;i<64;++i){
  ApuBridge s; setup(s);s.spc.ram[0x300]=0x8f;s.spc.ram[0x301]=(i&1)?0x20:0;s.spc.ram[0x302]=0xf3;s.spc.ram[0x303]=0xff;
  s.tickMasterCycles(672);
  assert(s.f3BusTrace.size()==1);
  const auto&e=s.f3BusTrace[0];
  assert(e.pc==0x300&&e.opcode==0x8f&&e.dspAddr==0x6c);
  assert(e.value==((i&1)?0x20:0));
  if(!(e.ordinal==4&&e.totalAccesses==4&&e.instructionCycles==5))std::cerr<<"DEBUG ordinal="<<e.ordinal<<" total="<<e.totalAccesses<<" cycles="<<e.instructionCycles<<"\n";
  assert(e.ordinal==4&&e.totalAccesses==4&&e.instructionCycles==5);
  assert(e.hasCompletion&&e.completedMaster>0&&e.writeAccepted);
  assert(s.f3BusTraceDropped==0);
  if(i==0){assert(s.saveF3BusTrace("f3trace.csv"));const auto txt=readText("f3trace.csv");assert(txt.find("pc,opcode,dsp_addr,value,")==0);assert(txt.find("access_ordinal_is_not_hardware_cycle=1")!=std::string::npos);}
  ++cases;
 }
 // MOVW dp, YA with dp=$F2 updates DSPADDR first and DSPDATA second.
 for(unsigned imm=0;imm<64;++imm){
  ApuBridge s; setup(s);s.spc.setA(0x6c);s.spc.setY((imm&1)?0x20:0);
  s.spc.ram[0x300]=0xda;s.spc.ram[0x301]=0xf2;s.spc.ram[0x302]=0xff;
  s.tickMasterCycles(672);
  assert(s.f3BusTrace.size()==1);
  const auto&e=s.f3BusTrace.front();
  assert(e.opcode==0xda&&e.pc==0x300&&e.dspAddr==0x6c);
  assert(e.ordinal==4&&e.totalAccesses==4&&e.value==s.spc.y());
  assert(e.hasCompletion&&e.instructionCycles>=4&&e.writeAccepted);
  ++cases;
 }
 // MOVW dp,YA with dp=$F3 writes DSPDATA before the other byte: distinguish order.
 for(unsigned imm=0;imm<64;++imm){
  ApuBridge s; setup(s);s.spc.setA((imm&1)?0x20:0);s.spc.setY(0x47);
  s.spc.ram[0x300]=0xda;s.spc.ram[0x301]=0xf3;s.spc.ram[0x302]=0xff;
  s.tickMasterCycles(672);
  assert(s.f3BusTrace.size()==1);
  const auto&e=s.f3BusTrace.front();
  assert(e.opcode==0xda&&e.ordinal==3&&e.totalAccesses==4);
  assert(e.value==s.spc.a()&&e.dspAddr==0x6c&&e.writeAccepted);
  ++cases;
 }
 // Bit7 inhibits F3 write; it must still be visible in logical trace.
 for(unsigned i=0;i<32;++i){
  ApuBridge s; setup(s);s.spc.dspAddr=0xec;
  s.spc.ram[0x300]=0x8f;s.spc.ram[0x301]=0x20;s.spc.ram[0x302]=0xf3;s.spc.ram[0x303]=0xff;
  s.tickMasterCycles(672);
  assert(s.f3BusTrace.size()==1&&!s.f3BusTrace[0].writeAccepted);
  assert(s.f3BusTrace[0].dspAddr==0xec&&s.dsp.effectiveFlg()==0);
  ++cases;
 }
 // Direct writes must not masquerade as instruction-timed events.
 {
   ApuBridge s; setup(s); s.spcWrite(0xf3,0x20);
   assert(s.f3BusTrace.empty());++cases;
 }
 // An isolated direct step records the access, but cannot guess completion time.
 {
   ApuBridge s;setup(s);s.spc.ram[0x300]=0x8f;s.spc.ram[0x301]=0x20;s.spc.ram[0x302]=0xf3;
   assert(forja65SpcStep(s)==5);
   assert(s.f3BusTrace.size()==1&&!s.f3BusTrace[0].hasCompletion);
   assert(s.f3BusTrace[0].ordinal==4&&s.f3BusTrace[0].totalAccesses==4);++cases;
 }
 // The opt-in may be disabled without recording or altering DSP writes.
 {
   ApuBridge s;setup(s);s.traceF3Bus=false;
   s.spc.ram[0x300]=0x8f;s.spc.ram[0x301]=0x20;s.spc.ram[0x302]=0xf3;
   s.tickMasterCycles(672);
   assert(s.f3BusTrace.empty()&&!s.saveF3BusTrace("should-not-exist.csv"));
   assert((s.dsp.effectiveFlg()&0x20u)==0x20u);++cases;
 }
 // Bounded capture: never allocate an unbounded trace during long gameplay.
 {
   ApuBridge s;setup(s);s.spc.ram[0x300]=0x8f;s.spc.ram[0x301]=0x20;s.spc.ram[0x302]=0xf3;
   for(unsigned i=0;i<4100;++i){s.spc.pc=0x300;assert(forja65SpcStep(s)==5);}
   assert(s.f3BusTrace.size()==4096 && s.f3BusTraceDropped==4);++cases;
 }
 std::cout<<"SPC_F3_BUS_ACCESS_TRACE_V043653_PASS cases="<<cases<<"\n";
}
