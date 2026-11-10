#include "spc_aot_test_common.hpp"
#include <random>
#include <iostream>
extern void forja65InstallSpcProfile(ApuBridge&);
int main(){
 std::mt19937 rng(0x700060);
 for(unsigned mode=0;mode<4;mode++){
  ApuBridge a;a.preciseSpcTiming=mode&1;a.fractionalDspClock=mode&2;a.nativeDspEnabled=true;
  a.spc.control=0;a.spc.pc=0x200;
  // Timer read-clear, dynamic branch, DSP address/write/read, output port, loop.
  const std::uint8_t code[]={0xe4,0xfd,0xd0,0x02,0xe8,0x00,0x8f,0x0c,0xf2,0xc4,0xf3,0xe4,0xf3,0xc4,0xf4,0x2f,0xef};
  std::copy(std::begin(code),std::end(code),a.spc.ram.begin()+0x200);
  a.spc.timersOn[0]=true;a.spc.timerTarget[0]=2;
  auto b=a;forja65InstallSpcProfile(a);
  // A non-executing scheduler slice must not train a pair or clear a timer.
  a.tickMasterCycles(1);b.tickMasterCycles(1);equal(a,b);
  for(unsigned i=0;i<5000;i++){
   unsigned clocks=rng()%180+1;
   if(i%31==0){a.spc.timerOut[0]=b.spc.timerOut[0]=std::uint8_t(rng()&15);}
   a.tickMasterCycles(clocks);b.tickMasterCycles(clocks);equal(a,b);
  }
  assert(a.fallbackMasterCycles==0&&b.nativeMasterCycles==0);
  assert(a.nativeMasterCycles==b.fallbackMasterCycles);
 }
 // This runtime represents SLEEP/STOP as PC-stationary loops; retain its exact semantics.
 for(unsigned op:{0xefu,0xffu}){
  ApuBridge a;a.spc.control=0;a.spc.pc=0x200;a.spc.ram[0x200]=op;
  auto b=a;forja65InstallSpcProfile(a);
  for(unsigned i=0;i<500;i++){a.tickMasterCycles(47);b.tickMasterCycles(47);equal(a,b);}
 }
 std::cout<<"PASS: reference training hook matches interpreter scheduler across four clock modes, dynamic IO/timer branches and SLEEP/STOP\n";
}
