#include "runtime.hpp"
#include <cstdint>
#include <iostream>
#include <vector>
#include <initializer_list>

static unsigned cases=0;
static bool expect_reads(std::initializer_list<std::uint16_t> expected,const char* name){
  if(forjaSpcReadSequenceTest!=std::vector<std::uint16_t>(expected)){
    std::cerr<<name<<" order mismatch: got";
    for(auto v:forjaSpcReadSequenceTest)std::cerr<<" $"<<std::hex<<v;
    std::cerr<<" expected";
    for(auto v:expected)std::cerr<<" $"<<std::hex<<v;
    std::cerr<<std::dec<<"\n";
    return false;
  }
  ++cases;return true;
}
static void reset(ApuBridge& a,bool page){
  a.correctedSpcSemantics=true;a.spc.control=0;
  a.spc.psw=page?0x20:0;
  a.spc.pc=0x300;
  forjaSpcReadSequenceTest.clear();
}
int main(){
  for(int page=0;page<2;++page){
    const auto base=page?0x100:0;
    for(unsigned off=0;off<256;++off){
      // Test direct page low->high and 0xff->0x00 wrap.
      ApuBridge a;reset(a,page!=0);
      const auto lo=(std::uint16_t)(base+off),hi=(std::uint16_t)(base+std::uint8_t(off+1u));
      if(!page&&(off>=0xF0||std::uint8_t(off+1u)>=0xF0)){
        // Reads of memory-mapped SPC registers are independently checked below.
        continue;
      }
      a.spc.ram[lo]=0x34;a.spc.ram[hi]=0x12;
      if(dpRead16(a,(std::uint8_t)off)!=0x1234 || !expect_reads({lo,hi},"dpRead16"))return 2;
    }
  }
  // The timer-output ports clear on read: both byte accesses must be tracked
  // and low-first even when both are side-effectful.
  for(unsigned off:{0xFCu,0xFDu,0xFEu,0xFFu}){
    ApuBridge a;reset(a,false);
    a.spc.timerOut[0]=4;a.spc.timerOut[1]=5;a.spc.timerOut[2]=6;
    const auto low=(std::uint16_t)off, high=(std::uint16_t)std::uint8_t(off+1u);
    const auto expectedLow=off==0xFC?0u:(off==0xFD?4u:(off==0xFE?5u:6u));
    const auto expectedHigh=off==0xFC?4u:(off==0xFD?5u:(off==0xFE?6u:0u));
    const auto value=dpRead16(a,(std::uint8_t)off);
    if(value!=(expectedLow|(expectedHigh<<8)) || !expect_reads({low,high},"timer DP") ||
       (off<0xFF && a.spc.timerOut[off==0xFC?0:off==0xFD?1:2]!=0))return 3;
  }
  // Absolute/vector pointer fetches must wrap at 0xffff and sequence low first.
  for(unsigned addr:{0x20u,0xFEu,0xFFFEu,0xFFFFu}){
    ApuBridge a;reset(a,false);
    const auto low=(std::uint16_t)addr, high=(std::uint16_t)(addr+1u);
    if(addr==0xFE){a.spc.timerOut[1]=0x0A;a.spc.timerOut[2]=0x0B;}
    else{a.spc.ram[low]=0x78;a.spc.ram[high]=0x56;}
    const auto expected=addr==0xFE?0x0B0Au:0x5678u;
    if(sr16(a,low)!=expected || !expect_reads({low,high},"sr16"))return 4;
  }
  // The indirect (dp+X) instruction fetches low/high pointer bytes before data.
  for(int page=0;page<2;++page){
    ApuBridge a;reset(a,page!=0);
    a.spc.pc=0x300;a.spc.ram[0x300]=0xE7; // MOV A,[dp+X]
    a.spc.ram[0x301]=page?0xFE:0xEE;a.spc.x=1;
    const auto base=page?0x100:0;
    const auto off=page?0xFF:0xEF;
    a.spc.ram[base+off]=0x30;a.spc.ram[base+std::uint8_t(off+1)]=0x04;
    // On direct page zero, the high pointer byte is TEST ($F0), which
    // reads zero regardless of its backing RAM shadow. Page one is RAM.
    const std::uint16_t target=page?0x0430:0x0030;
    a.spc.ram[target]=0xA6;
    forja65SpcStep(a);
    if(a.spc.a()!=0xA6){std::cerr<<"indirect X wrong A="<<std::hex<<unsigned(a.spc.a())<<" page="<<page<<" pc="<<a.spc.pc<<"\n";return 5;}
    if(!expect_reads({0x300,0x301,(std::uint16_t)(base+off),(std::uint16_t)(base+std::uint8_t(off+1)),target},"MOV A,[dp+X]"))return 5;
  }
  // The indirect (dp)+Y instruction uses the same low/high ordering and
  // correctly adds Y after constructing the 16-bit pointer.
  for(int page=0;page<2;++page){
    ApuBridge a;reset(a,page!=0);
    a.spc.pc=0x300;a.spc.ram[0x300]=0xF7; // MOV A,[dp]+Y
    a.spc.ram[0x301]=page?0xFF:0xEF;a.spc.setY(3);
    const auto base=page?0x100:0;
    const auto off=page?0xFF:0xEF;
    a.spc.ram[base+off]=0x30;a.spc.ram[base+std::uint8_t(off+1)]=0x04;
    const std::uint16_t target=page?0x0433:0x0033;
    a.spc.ram[target]=0x5C;
    forja65SpcStep(a);
    if(a.spc.a()!=0x5C||!expect_reads({0x300,0x301,(std::uint16_t)(base+off),(std::uint16_t)(base+std::uint8_t(off+1)),target},"MOV A,[dp]+Y"))return 6;
  }
  // JMP [abs+X] crosses $FFFF, and both reads must be in low/high order.
  {
    ApuBridge a;reset(a,false);
    a.spc.pc=0x300;a.spc.ram[0x300]=0x1F;a.spc.ram[0x301]=0xFD;a.spc.ram[0x302]=0xFF;
    a.spc.x=2;a.spc.ram[0xFFFF]=0x34;a.spc.ram[0]=0x12;
    forja65SpcStep(a);
    if(a.spc.pc!=0x1234||!expect_reads({0x300,0x301,0x302,0xFFFF,0},"JMP [abs+X]"))return 7;
  }
  std::cout<<"SPC_INDIRECT_POINTER_ORDER_V043659_PASS cases="<<cases<<"\n";
}
