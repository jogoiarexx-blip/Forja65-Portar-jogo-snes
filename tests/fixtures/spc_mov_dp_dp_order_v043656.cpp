#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>

static void setup(ApuBridge& a,std::uint8_t src,std::uint8_t dst,bool page1=false){
  a.spc.pc=0x300;
  a.spc.control=0;
  a.spc.psw=page1?0x20:0;
  a.spc.ram[0x300]=0xFA; // MOV dp<d>, dp<s>
  a.spc.ram[0x301]=src;
  a.spc.ram[0x302]=dst;
}
int main(){
  unsigned scenarios=0;
  // Ordinary RAM, including source==destination and address wrap.
  for(unsigned source=0;source<256;++source){
    for(unsigned page=0;page<2;++page){
      ApuBridge a;
      const std::uint8_t src=static_cast<std::uint8_t>(source);
      const std::uint8_t dst=static_cast<std::uint8_t>((source+37u)&255u);
      setup(a,src,dst,page!=0);
      const unsigned base=page?0x100:0;
      if(!page && (src>=0xF0 || dst>=0xF0)) continue;
      // Do not put the synthetic program into direct page 0x03xx.
      a.spc.ram[base+src]=static_cast<std::uint8_t>(source^0x5Au);
      const auto value=a.spc.ram[base+src];
      assert(forja65SpcStep(a)==5);
      assert(a.spc.pc==0x303);
      assert(a.spc.ram[base+dst]==value);
      ++scenarios;
    }
  }
  // Timer outputs read-to-clear; result is written to the DSP DATA port.
  for(unsigned timer=0;timer<3;++timer)for(unsigned value=0;value<16;++value){
    ApuBridge a; setup(a,static_cast<std::uint8_t>(0xFD+timer),0xF3);
    a.spc.dspAddr=0x0C; // Left master volume (read/write DSP register)
    a.spc.timerOut[timer]=static_cast<std::uint8_t>(value);
    assert(forja65SpcStep(a)==5);
    assert(a.spc.timerOut[timer]==0);
    assert(a.dsp.readReg(0x0C)==value);
    ++scenarios;
  }
  // Reading DSPDATA with an old DSPADDR before writing a new DSPADDR.
  for(unsigned value=0;value<128;++value){
    ApuBridge a;setup(a,0xF3,0xF2);a.spc.dspAddr=0x0C;
    a.dsp.writeReg(0x0C,static_cast<std::uint8_t>(value),a.spc.ram);
    const auto v=a.dsp.readReg(0x0C);
    assert(forja65SpcStep(a)==5);
    assert(a.spc.dspAddr==v);
    ++scenarios;
  }
  // Relocated direct page: $01FD is RAM, not a read-to-clear timer.
  for(unsigned value=0;value<16;++value){
    ApuBridge a;setup(a,0xFD,0xF3,true);
    a.spc.timerOut[0]=12;
    a.spc.ram[0x1FD]=static_cast<std::uint8_t>(value);
    assert(forja65SpcStep(a)==5);
    assert(a.spc.timerOut[0]==12);
    assert(a.spc.ram[0x1F3]==value);
    ++scenarios;
  }
  // Trace still correctly captures the F3 write with stable opcode and PC.
  {
    ApuBridge a;setup(a,0xFD,0xF3);a.spc.timerOut[0]=9;
    a.spc.dspAddr=0x0C;a.traceF3Bus=true;
    assert(forja65SpcStep(a)==5);
    assert(a.f3BusTrace.size()==1);
    const auto& t=a.f3BusTrace[0];
    assert(t.opcode==0xFA && t.pc==0x300 && t.value==9 && t.writeAccepted);
    ++scenarios;
  }
  std::cout << "SPC_MOV_DP_DP_ORDER_V043656_PASS cases=" << scenarios << "\n";
}
