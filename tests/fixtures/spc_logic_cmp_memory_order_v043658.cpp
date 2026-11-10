#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cstdint>
#include <iostream>

static constexpr std::uint8_t N=0x80, Z=0x02, C=0x01, V=0x40, H=0x08;
static bool indexed(unsigned op){return (op&15)==9 && ((op>>4)&1)!=0;}
static bool comparison(unsigned op){return op==0x69||op==0x79;}
static std::uint8_t result(unsigned op,unsigned lhs,unsigned rhs){
  if(comparison(op))return std::uint8_t(lhs-rhs);
  if(op==0x09||op==0x19)return std::uint8_t(lhs|rhs);
  if(op==0x29||op==0x39)return std::uint8_t(lhs&rhs);
  return std::uint8_t(lhs^rhs);
}
static void prepare(ApuBridge& a,unsigned op,bool page,unsigned dst=0x40,unsigned src=0x41){
  a.correctedSpcSemantics=true;
  a.accurateSpcTiming=true;
  a.spc.control=0;
  a.spc.pc=0x300;
  a.spc.psw=(page?0x20:0)|V|H;
  a.spc.ram[0x300]=std::uint8_t(op);
  a.spc.ram[0x301]=std::uint8_t(src);
  a.spc.ram[0x302]=std::uint8_t(dst);
  a.spc.x=std::uint8_t(dst);
  a.spc.setY(std::uint8_t(src));
  a.spc.setA(0x7e);
}
static bool flags_ok(const ApuBridge& a,unsigned op,unsigned lhs,unsigned rhs){
 const auto r=result(op,lhs,rhs);
 const unsigned wanted=(r&N)|(r==0?Z:0)|(comparison(op)?(lhs>=rhs?C:0):0)|V|H;
 const unsigned mask=N|Z|V|H|(comparison(op)?C:0);
 return (a.spc.psw&mask)==(wanted&mask);
}
int main(){
  std::uint64_t cases=0;
  const unsigned ops[]={0x09,0x19,0x29,0x39,0x49,0x59,0x69,0x79};
  for(auto op:ops)for(unsigned page=0;page<2;page++)for(unsigned lhs=0;lhs<256;lhs++)
    for(unsigned rhs:{0u,1u,15u,63u,127u,128u,255u}){
      ApuBridge a;prepare(a,op,page!=0);const auto base=page?0x100:0;
      a.spc.ram[base+0x40]=std::uint8_t(lhs);
      a.spc.ram[base+0x41]=std::uint8_t(rhs);
      int cycles=forja65SpcStep(a);
      const auto expected=result(op,lhs,rhs);
      if(cycles!=(indexed(op)?5:6)||a.spc.pc!=(unsigned)(indexed(op)?0x301:0x303)||
          a.spc.ram[base+0x40]!=(comparison(op)?lhs:expected)||
          a.spc.ram[base+0x41]!=rhs||a.spc.a()!=0x7e||!flags_ok(a,op,lhs,rhs)){
        std::cerr<<"RAM FAIL op="<<std::hex<<op<<" page="<<page<<" lhs="<<lhs<<" rhs="<<rhs<<"\n";return 2;
      }
      ++cases;
    }
  // Both reads go to a read-to-clear timer. CMP exposes their order in flags:
  // destination-first => old_count - 0; reverse => 0 - old_count.
  for(auto op:ops)for(unsigned timer=0;timer<3;timer++)for(unsigned value=1;value<16;value++){
    ApuBridge a;prepare(a,op,false,0xFD+timer,0xFD+timer);
    a.spc.timerOut[timer]=std::uint8_t(value);
    forja65SpcStep(a);
    if(a.spc.timerOut[timer]!=0||!flags_ok(a,op,value,0)){
      std::cerr<<"TIMER ORDER FAIL op="<<std::hex<<op<<" timer="<<timer<<" value="<<value<<" psw="<<unsigned(a.spc.psw)<<"\n";return 3;
    }
    ++cases;
  }
  // Source reads timer once; destination DSPDATA must receive the result.
  for(auto op:ops)if(!comparison(op))for(unsigned timer=0;timer<3;timer++)for(unsigned value=0;value<16;value++){
    ApuBridge a;prepare(a,op,false,0xF3,0xFD+timer);
    a.spc.dspAddr=0x0c;a.dsp.writeReg(0x0c,0x5a,a.spc.ram);
    a.spc.timerOut[timer]=std::uint8_t(value);
    forja65SpcStep(a);
    if(a.spc.timerOut[timer]!=0||a.dsp.readReg(0x0c)!=result(op,0x5a,value)||!flags_ok(a,op,0x5a,value)){
      std::cerr<<"DSP/TIMER FAIL op="<<std::hex<<op<<" timer="<<timer<<" value="<<value<<"\n";return 4;
    }
    ++cases;
  }
  // No unintended promotion of the compatibility profile.
  for(auto op:ops){ApuBridge a;prepare(a,op,false);a.correctedSpcSemantics=false;
    a.spc.ram[0x40]=3;a.spc.ram[0x41]=7;forja65SpcStep(a);
    if(a.correctedSpcSemantics){std::cerr<<"LEGACY PROFILE CHANGED\n";return 5;}
    ++cases;
  }
  std::cout<<"SPC_LOGIC_CMP_MEMORY_ORDER_V043658_PASS cases="<<cases<<"\n";
}
