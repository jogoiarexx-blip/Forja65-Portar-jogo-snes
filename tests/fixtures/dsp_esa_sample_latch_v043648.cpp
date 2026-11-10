#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>

static void sample(std::vector<std::uint8_t>&r,unsigned p,int l,int rr){
  const unsigned a=p&0xffffu;
  const unsigned x=std::uint16_t(l),y=std::uint16_t(rr);
  r[a]=std::uint8_t(x);r[(a+1)&65535u]=std::uint8_t(x>>8);
  r[(a+2)&65535u]=std::uint8_t(y);r[(a+3)&65535u]=std::uint8_t(y>>8);
}
static void configure(SpcDsp&d,std::vector<std::uint8_t>&r,unsigned base,unsigned delay=1){
  d.hardwareEchoFir=true;d.echoRamWritesAllowed=false;
  d.writeReg(0x6d,std::uint8_t(base),r);
  d.writeReg(0x7d,std::uint8_t(delay),r);
  d.writeReg(0x4d,0,r);
  d.writeReg(0x7f,127,r);
  d.processEcho(r,0,0);
}
static std::array<int,2> latest(const SpcDsp&d){
  return d.echoHistory[(d.echoHistoryPos+7)&7u];
}
int main(){
  unsigned cases=0;
  // All 256 possible ESA pages, with writes to a DIFFERENT base after the
  // first sample. The current sample still uses the previous latched base.
  for(unsigned page=0;page<256;page++){
    const unsigned next=(page+91u)&255u;
    std::vector<std::uint8_t>ram(65536,0);
    SpcDsp d;configure(d,ram,page);
    sample(ram,page*256u+4,6000,-5000);
    sample(ram,next*256u+4,10000,-7000);
    d.writeReg(0x6d,std::uint8_t(next),ram);
    const auto pos=d.echoPosition;
    d.processEcho(ram,0,0);
    assert((latest(d)==std::array<int,2>{3000,-2500}));
    assert(d.echoPosition==pos+4);
    sample(ram,page*256u+8,11000,-6000);
    sample(ram,next*256u+8,12000,-8000);
    d.processEcho(ram,0,0);
    assert((latest(d)==std::array<int,2>{6000,-4000}));
    ++cases;
  }
  // EDL=0 is a 4-byte ring. Changing ESA still takes effect a frame later;
  // sample boundaries never erase FIR history.
  for(unsigned page=0;page<256;page++){
    const unsigned next=(page+63u)&255u;
    std::vector<std::uint8_t>ram(65536,0);
    SpcDsp d;configure(d,ram,page,0);
    d.echoHistory[3]={123,-456};
    sample(ram,page*256u,2000,-4000);
    sample(ram,next*256u,4000,-6000);
    d.writeReg(0x6d,std::uint8_t(next),ram);
    d.processEcho(ram,0,0);
    assert((latest(d)==std::array<int,2>{1000,-2000}));
    assert(d.echoHistory[3][0]==123 && d.echoHistory[3][1]==-456);
    assert(d.echoActiveBytes==4 && d.echoPosition==0);
    d.processEcho(ram,0,0);
    assert((latest(d)==std::array<int,2>{2000,-3000}));
    ++cases;
  }
  // Last write wins; with different register writes before the next sample,
  // it must still use the previous latched value for that sample.
  for(unsigned page=0;page<256;page++){
    const unsigned target=(page+121u)&255u;
    std::vector<std::uint8_t>ram(65536,0);
    SpcDsp d;configure(d,ram,page);
    sample(ram,page*256u+4,6000,2000);
    sample(ram,target*256u+8,8000,4000);
    d.writeReg(0x6d,std::uint8_t((page+47)&255u),ram);
    d.writeReg(0x6d,std::uint8_t(target),ram);
    d.processEcho(ram,0,0);
    assert((latest(d)==std::array<int,2>{3000,1000}));
    d.processEcho(ram,0,0);
    assert((latest(d)==std::array<int,2>{4000,2000}));
    ++cases;
  }
  // Explicit legacy behavior: immediate ESA change, not a latched change.
  for(unsigned page=0;page<256;page++){
    const unsigned next=(page+91u)&255u;
    std::vector<std::uint8_t>ram(65536,0);
    SpcDsp d;configure(d,ram,page);
    d.hardwareEchoFir=false;
    sample(ram,page*256u+4,4000,2000);
    sample(ram,next*256u+4,8000,6000);
    d.writeReg(0x6d,std::uint8_t(next),ram); // legacy resets ring
    assert(d.echoPosition==0);
    sample(ram,next*256u,5000,-3000);
    d.processEcho(ram,0,0);
    assert((latest(d)==std::array<int,2>{5000,-3000}));
    ++cases;
  }
  // Chunking must produce the same PCM and echo state.
  for(unsigned page=0;page<16;page++){
    std::vector<std::uint8_t>ra(65536,0),rb(65536,0);
    SpcDsp a,b;configure(a,ra,page+0x20);configure(b,rb,page+0x20);
    a.writeReg(0x6d,std::uint8_t(page+0x40),ra);
    b.writeReg(0x6d,std::uint8_t(page+0x40),rb);
    a.writeReg(0x2c,127,ra);b.writeReg(0x2c,127,rb);
    sample(ra,(page+0x40)*256+8,8000,-8000);
    sample(rb,(page+0x40)*256+8,8000,-8000);
    auto full=a.render(ra,60);
    auto partial=b.render(rb,7);
    auto rest=b.render(rb,53);
    partial.insert(partial.end(),rest.begin(),rest.end());
    assert(full==partial && ra==rb);
    assert(a.echoPosition==b.echoPosition);
    ++cases;
  }
  std::cout<<"DSP_ESA_SAMPLE_LATCH_V043648_PASS cases="<<cases<<"\n";
}
