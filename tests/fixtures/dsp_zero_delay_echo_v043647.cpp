#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>

static void seed(std::vector<std::uint8_t>& ram,unsigned a,int left,int right){
  const unsigned l=unsigned(std::uint16_t(left)),r=unsigned(std::uint16_t(right));
  ram[a&65535u]=std::uint8_t(l);
  ram[(a+1)&65535u]=std::uint8_t(l>>8);
  ram[(a+2)&65535u]=std::uint8_t(r);
  ram[(a+3)&65535u]=std::uint8_t(r>>8);
}
static void setup(SpcDsp&d,std::vector<std::uint8_t>&ram,unsigned base){
  d.hardwareEchoFir=true;
  d.writeReg(0x6d,std::uint8_t(base>>8),ram);
  d.writeReg(0x7d,0,ram); // zero delay is one stereo frame
  d.writeReg(0x4d,0,ram); // no voices contribute to echo input
  d.writeReg(0x0f,127,ram); // use the newest FIR sample (tap 7)
  d.writeReg(0x7f,127,ram);
  d.writeReg(0x0d,0,ram); // no feedback; only current inputs get written
  d.writeReg(0x6c,0,ram); // explicitly enable echo writes; hardware boots write-protected
}
int main(){
  unsigned cases=0;
  // Every possible page is checked, including 0xFF00->0x0000 addressing.
  for(unsigned page=0;page<256;page++){
    const unsigned base=page<<8;
    std::vector<std::uint8_t>ram(65536,0);
    SpcDsp d;setup(d,ram,base);
    seed(ram,base,2048,-2048);
    const auto wet=d.processEcho(ram,0,0);
    assert(wet[0]!=0 && wet[1]!=0); // EON=EDL=0 must still read FIR input
    assert(d.echoHistoryPos==1 && d.echoPosition==0);
    assert(d.echoActiveBytes==4 && d.echoDelayInitialized);
    assert(SpcDsp::readSigned16(ram,base)==0);
    assert(SpcDsp::readSigned16(ram,base+2)==0);
    ++cases;
  }
  // FLG write-protect does not stop reads or advances.
  for(unsigned flag : {0u,0x20u,0x60u,0xA0u}){
    std::vector<std::uint8_t>ram(65536,0);
    SpcDsp d;setup(d,ram,0x3F00);
    d.writeReg(0x6c,std::uint8_t(flag),ram);
    seed(ram,0x3F00,2048,-2048);
    const auto wet=d.processEcho(ram,1000,-1000);
    assert(wet[0]!=0 && wet[1]!=0);
    assert(d.echoHistoryPos==1 && d.echoPosition==0);
    assert(SpcDsp::readSigned16(ram,0x3F00)==(flag&0x20u?2048:1000));
    assert(SpcDsp::readSigned16(ram,0x3F02)==(flag&0x20u?-2048:-1000));
    ++cases;
  }
  // Legacy compatibility retains the old EON=EDL=0 skip.
  {
    std::vector<std::uint8_t>ram(65536,0);
    SpcDsp d;setup(d,ram,0x3F00);d.hardwareEchoFir=false;
    seed(ram,0x3F00,2048,-2048);
    assert((d.processEcho(ram,0,0)==std::array<int,2>{0,0}));
    assert(d.echoHistoryPos==0 && SpcDsp::readSigned16(ram,0x3F00)==2048);
    ++cases;
  }
  // An unconfigured echo block still avoids clobbering memory at power-on.
  {
    std::vector<std::uint8_t>ram(65536,0);
    SpcDsp d;d.hardwareEchoFir=true;
    seed(ram,0,2048,-2048);
    assert((d.processEcho(ram,0,0)==std::array<int,2>{0,0}));
    assert(SpcDsp::readSigned16(ram,0)==2048);
    ++cases;
  }
  // Same output and internal state regardless of audio block sizes.
  {
    std::vector<std::uint8_t>ra(65536,0),rb(65536,0);
    SpcDsp a,b;setup(a,ra,0x3400);setup(b,rb,0x3400);
    seed(ra,0x3400,4096,-4096);seed(rb,0x3400,4096,-4096);
    a.writeReg(0x2c,127,ra);a.writeReg(0x3c,127,ra);
    b.writeReg(0x2c,127,rb);b.writeReg(0x3c,127,rb);
    const auto whole=a.render(ra,129);
    auto pieces=b.render(rb,7);
    const auto rest=b.render(rb,122);pieces.insert(pieces.end(),rest.begin(),rest.end());
    assert(whole==pieces && ra==rb);
    assert(a.echoHistoryPos==b.echoHistoryPos && a.echoPosition==b.echoPosition);
    ++cases;
  }
  std::cout<<"DSP_ZERO_DELAY_ECHO_V043647_PASS cases="<<cases<<"\n";
}
