#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <vector>

static constexpr std::uint8_t N=0x80,V=0x40,H=0x08,Z=0x02,C=0x01;
static bool sub(unsigned op){return op==0xA9||op==0xB9;}
static bool indexed(unsigned op){return op==0x99||op==0xB9;}
static int expected(std::uint8_t a,std::uint8_t b,bool subtract,unsigned carry){
  int r=subtract?int(a)-int(b)-(1-int(carry)):int(a)+int(b)+int(carry);
  const std::uint8_t result=(std::uint8_t)r;
  const bool half=subtract?((a&15)>=(unsigned(b&15)+(1-carry))):((a&15)+(b&15)+carry>15);
  const bool overflow=subtract?(((a^b)&(a^r)&128)!=0):(((~(a^b))&(a^r)&128)!=0);
  const bool c=subtract?(r>=0):(r>255);
  return (result&N)|(result==0?Z:0)|(half?H:0)|(overflow?V:0)|(c?C:0);
}
static void prepare(ApuBridge& a,unsigned op,bool page,unsigned carry,unsigned dst=0x40,unsigned src=0x41){
  a.correctedSpcSemantics=true;
  a.accurateSpcTiming=true;
  a.spc.control=0;
  a.spc.pc=0x300;
  a.spc.psw=(page?0x20:0)|(carry?C:0);
  a.spc.ram[0x300]=(std::uint8_t)op;
  a.spc.ram[0x301]=(std::uint8_t)src;
  a.spc.ram[0x302]=(std::uint8_t)dst;
  a.spc.x=(std::uint8_t)dst;
  a.spc.setY((std::uint8_t)src);
  a.spc.setA(0x4b);
}
int main(){
  std::uint64_t checks=0;
  const unsigned ops[]={0x89,0x99,0xA9,0xB9};
  for(const auto op:ops)for(unsigned page=0;page<2;++page)
    for(unsigned aa=0;aa<256;++aa)for(unsigned bb:{0u,1u,15u,16u,63u,127u,128u,255u})
      for(unsigned carry=0;carry<2;++carry){
        ApuBridge a;prepare(a,op,page!=0,carry);
        const unsigned base=page?0x100:0;
        a.spc.ram[base+0x40]=(std::uint8_t)aa;
        a.spc.ram[base+0x41]=(std::uint8_t)bb;
        const auto oldA=a.spc.a();
        const unsigned cycles=forja65SpcStep(a);
        const int sum=sub(op)?int(aa)-int(bb)-(1-int(carry)):int(aa)+int(bb)+int(carry);
        const auto result=(std::uint8_t)sum;
        if(cycles!=(indexed(op)?5u:6u) || a.spc.pc!=0x300u+(indexed(op)?1u:3u) ||
           a.spc.ram[base+0x40]!=result || a.spc.ram[base+0x41]!=(std::uint8_t)bb ||
           a.spc.a()!=oldA || (a.spc.psw&(N|V|H|Z|C))!=expected((std::uint8_t)aa,(std::uint8_t)bb,sub(op),carry)){
          std::cerr<<"FAIL op="<<std::hex<<op<<" dp="<<page<<" a="<<aa<<" b="<<bb<<" c="<<carry<<"\n";return 2;
        }
        ++checks;
      }
  // DSPDATA is a memory destination; timer read must clear only once.
  for(const auto op:ops)for(unsigned timer=0;timer<3;++timer)for(unsigned value=0;value<16;++value){
    ApuBridge a;prepare(a,op,false,0,0xF3,0xFD+timer);
    a.spc.dspAddr=0x0c;
    a.dsp.writeReg(0x0c,0x13,a.spc.ram);
    a.spc.timerOut[timer]=(std::uint8_t)value;
    const auto expectedValue=(std::uint8_t)(sub(op)?(0x13-int(value)-1):(0x13+int(value)));
    forja65SpcStep(a);
    if(a.spc.timerOut[timer]!=0||a.dsp.readReg(0x0c)!=expectedValue){
      std::cerr<<"DSP/TIMER FAIL op="<<std::hex<<op<<" timer="<<timer<<" value="<<value<<"\n";return 3;
    }
    ++checks;
  }
  // When the source and destination both refer to a read-to-clear counter,
  // destination is fetched first. SBC must see old value - cleared value.
  for(const auto op:ops)if(sub(op))for(unsigned timer=0;timer<3;++timer)
    for(unsigned value=1;value<16;++value){
      ApuBridge a;prepare(a,op,false,1,0xFD+timer,0xFD+timer);
      a.spc.timerOut[timer]=(std::uint8_t)value;
      forja65SpcStep(a);
      if(a.spc.timerOut[timer]!=0||(a.spc.psw&(N|V|H|Z|C))!=expected((std::uint8_t)value,0,true,1)){
        std::cerr<<"READ-TO-CLEAR ORDER FAIL "<<std::hex<<op<<" count="<<value<<"\n";return 4;
      }
      ++checks;
    }
  // Destination $F2 and source $F3: read DSPDATA using OLD DSPADDR,
  // then write new DSPADDR (do not re-read the changed register).
  for(const auto op:ops)for(unsigned value=0;value<64;++value){
    ApuBridge a;prepare(a,op,false,1,0xF2,0xF3);
    a.spc.dspAddr=0x0c;
    a.dsp.writeReg(0x0c,(std::uint8_t)value,a.spc.ram);
    const std::uint8_t changed=(std::uint8_t)(sub(op)?(0x0c-value):(0x0c+value+1));
    forja65SpcStep(a);
    if(a.spc.dspAddr!=changed){std::cerr<<"DSPADDR ORDER FAIL "<<std::hex<<op<<" value="<<value<<"\n";return 5;}
    ++checks;
  }
  // Legacy profile preserves previous semantics; it is not implicitly promoted.
  for(const auto op:ops){
    ApuBridge a;prepare(a,op,false,0);a.correctedSpcSemantics=false;
    a.spc.ram[0x40]=3;a.spc.ram[0x41]=7;
    forja65SpcStep(a);
    if(a.correctedSpcSemantics){std::cerr<<"LEGACY SWITCH CHANGED\n";return 6;}
    ++checks;
  }
  std::cout<<"SPC_ADC_SBC_MEMORY_ORDER_V043657_PASS cases="<<checks<<"\n";
}
