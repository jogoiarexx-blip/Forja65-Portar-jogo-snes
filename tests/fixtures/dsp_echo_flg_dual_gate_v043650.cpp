#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>

static void setup(SpcDsp&d,std::vector<std::uint8_t>&ram,unsigned page){
 d.hardwareEchoFir=true;
 d.writeReg(0x6d,std::uint8_t(page),ram);
 d.writeReg(0x7d,0,ram);
 d.writeReg(0x4d,0,ram);
 d.writeReg(0x0d,0,ram);
 d.writeReg(0x6c,0,ram);
}
int main(){
 unsigned cases=0;
 // The true pipeline samples FLG twice: cycle 28 for left, 29 for right.
 // The phase hook exposes an injection seam; it is NOT a scheduler itself.
 for(unsigned page=0;page<256;page++){
  for(unsigned transition=0;transition<4;transition++){
   std::vector<std::uint8_t>ram(65536,0);
   SpcDsp d;setup(d,ram,page);
   const unsigned base=page<<8;
   SpcDsp::writeSigned16(ram,base,8000);
   SpcDsp::writeSigned16(ram,base+2,-8000);
   const bool leftEnabled=(transition&1u)!=0;
   const bool rightEnabled=(transition&2u)!=0;
   d.writeReg(0x6c,leftEnabled?0u:0x20u,ram);
   unsigned phases=0;
   const auto wet=d.processEcho(ram,1234,-2346,[&](unsigned phase){
    if(phase==28u){assert(phases==0);phases=1;}
    else if(phase==29u){assert(phases==1);phases=2;d.writeReg(0x6c,rightEnabled?0u:0x20u,ram);}
    else assert(false);
   });
   assert(phases==2);
   assert(SpcDsp::readSigned16(ram,base)==(leftEnabled?1234:8000));
   assert(SpcDsp::readSigned16(ram,base+2)==(rightEnabled?-2346:-8000));
   assert(d.echoHistoryPos==1 && d.echoPosition==0);
   // Muting/protecting echo writes never stops FIR memory reads.
   assert(d.echoHistory[0][0]==4000 && d.echoHistory[0][1]==-4000);
   (void)wet;
   ++cases;
  }
 }
 // No callback: existing sample-level API retains both-channel gates.
 for(unsigned state:{0u,0x20u}){
   std::vector<std::uint8_t>ram(65536,0);
   SpcDsp d;setup(d,ram,0x12);
   SpcDsp::writeSigned16(ram,0x1200,8000);
   SpcDsp::writeSigned16(ram,0x1202,-8000);
   d.writeReg(0x6c,std::uint8_t(state),ram);
   d.processEcho(ram,1234,-2346);
   assert(SpcDsp::readSigned16(ram,0x1200)==(state?8000:1234));
   assert(SpcDsp::readSigned16(ram,0x1202)==(state?-8000:-2346));
   ++cases;
 }
 // Legacy mode does not call the new hook and retains the old semantics.
 {
   std::vector<std::uint8_t>ram(65536,0);
   SpcDsp d;setup(d,ram,0x33);d.hardwareEchoFir=false;
   d.writeReg(0x7d,1,ram);
   unsigned phaseCalls=0;
   d.processEcho(ram,1000,-1000,[&](unsigned){++phaseCalls;});
   assert(phaseCalls==0);
   ++cases;
 }
 // Global ARAM lock prevents writes even if the hook tries to enable FLG.
 {
   std::vector<std::uint8_t>ram(65536,0x77);
   SpcDsp d;setup(d,ram,0x31);d.echoRamWritesAllowed=false;
   auto before=ram;
   d.processEcho(ram,1000,-1000,[&](unsigned){d.writeReg(0x6c,0,ram);});
   assert(ram==before && d.echoHistoryPos==1);
   ++cases;
 }
 std::cout<<"DSP_ECHO_FLG_DUAL_GATE_V043650_PASS cases="<<cases<<"\n";
}
