#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <iostream>
#include <random>
#include <set>
#include <cstring>
extern int forja65SpcNativeStep(ApuBridge&);
extern unsigned forja65SpcNativePredict(const ApuBridge&);
extern void forja65InstallSpcNative(ApuBridge&);
extern bool forja65SpcNativePair(unsigned,std::uint16_t&,std::uint8_t&);
#include "spc_aot_test_common.hpp"
int main(){
 std::mt19937 rng(0x700060);std::set<unsigned> seen;std::set<unsigned> knownPCs,knownPairs;unsigned states=0,sites=0;
 std::uint16_t pc;std::uint8_t op;
 for(unsigned pair=0;forja65SpcNativePair(pair,pc,op);pair++){
  knownPCs.insert(pc);knownPairs.insert((unsigned(pc)<<8)|op);
  const bool first=seen.insert(op).second;sites++;
  // 128 states for each opcode form, plus one state at every additional site.
  for(unsigned n=0;n<(first?128u:1u);n++){
   ApuBridge a;a.preciseSpcTiming=(n&1);a.spc.control=0;a.spc.pc=pc;
   for(auto&v:a.spc.ram)v=std::uint8_t(rng());
   a.spc.ram[pc]=op;a.spc.ya=rng();a.spc.x=rng();a.spc.psw=rng();a.spc.sp=rng();
   a.spc.dspAddr=rng();
   // Explicitly include IO operands, wrapping DP and independent immediate bytes.
   if(n<16)a.spc.ram[std::uint16_t(pc+1)]=0xf0+n;
   for(unsigned i=0;i<4;i++){a.spc.portIn[i]=rng();a.spc.portOut[i]=rng();}
   for(unsigned i=0;i<3;i++){
    a.spc.timerOut[i]=rng()&15;a.spc.timerDiv[i]=rng()%(i==2?16:128);
    a.spc.timerStage[i]=rng()&255;a.spc.timerTarget[i]=rng();a.spc.timersOn[i]=rng()&1;
   }
   auto b=a;assert(forja65SpcNativePredict(a)==forja65SpcPredictCycles(b));
   const auto want=forja65SpcStep(b),got=forja65SpcNativeStep(a);
   assert(want==got);equal(a,b);states++;
  }
 }
 assert(states>0);
 // Unknown PC and unexpected opcode fail before mutating machine state.
 {ApuBridge a;a.spc.control=0;a.spc.pc=0;while(knownPCs.count(a.spc.pc))a.spc.pc++;auto b=a;bool threw=false;
  try{forja65SpcNativeStep(a);}catch(const std::runtime_error&){threw=true;}assert(threw);equal(a,b);}
 {forja65SpcNativePair(0,pc,op);ApuBridge a;a.spc.control=0;a.spc.pc=pc;unsigned bad=0;while(knownPairs.count((unsigned(pc)<<8)|bad))bad++;assert(bad<256);a.spc.ram[pc]=std::uint8_t(bad);auto b=a;bool threw=false;
  try{forja65SpcNativeStep(a);}catch(const std::runtime_error&){threw=true;}assert(threw);equal(a,b);}
 // Scheduler/DSP parity on the immutable IPL loop, randomized master slices.
 for(unsigned mode=0;mode<4;mode++){
 ApuBridge a;a.preciseSpcTiming=(mode&1);a.fractionalDspClock=(mode&2);a.nativeDspEnabled=true;a.spc.control=0x80;a.spc.pc=0xffc0;
 // BRR source and active noise voice guarantee non-silent DSP/PCM comparisons.
 a.spc.ram[0x400]=0;a.spc.ram[0x401]=5;a.spc.ram[0x402]=0;a.spc.ram[0x403]=5;
 a.spc.ram[0x500]=0xa3;for(unsigned i=0;i<8;i++)a.spc.ram[0x501+i]=(i&1)?0x07:0x70;
 for(auto setting: {std::pair<unsigned,unsigned>{0x5d,4},{0x0c,127},{0x1c,127},{0x00,127},{0x01,127},{0x03,6},{0x07,127},{0x6c,31},{0x3d,1},{0x4c,1}})
  a.dsp.writeReg(setting.first,setting.second,a.spc.ram);
 auto b=a;forja65InstallSpcNative(a);
 for(unsigned i=0;i<5000;i++){
  unsigned clocks=rng()%180+1;a.tickMasterCycles(clocks);b.tickMasterCycles(clocks);equal(a,b);
 }
 assert(std::any_of(a.nativePcm.begin(),a.nativePcm.end(),[](auto value){return value!=0;}));
 }
 std::cout<<"PASS: "<<seen.size()<<" opcode forms / "<<sites<<" PC/opcode sites / "<<states<<" differential states, 20000 scheduler/DSP/non-silent PCM slices across four clock modes, fail-closed guards\n";
}
