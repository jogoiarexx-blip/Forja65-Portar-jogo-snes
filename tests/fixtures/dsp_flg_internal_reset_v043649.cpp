#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>

static void sample(std::vector<std::uint8_t>&ram,unsigned pos,int left,int right){
  SpcDsp::writeSigned16(ram,pos,left);
  SpcDsp::writeSigned16(ram,(pos+2u)&65535u,right);
}
int main(){
  unsigned cases=0;
  for(unsigned page=0;page<256;page++){
    const unsigned addr=(page*256u)&65535u;
    std::vector<std::uint8_t>ram(65536,0x5a);
    SpcDsp dsp;dsp.hardwareEchoFir=true;dsp.echoRamWritesAllowed=true;
    dsp.writeReg(0x6d,std::uint8_t(page),ram);
    dsp.writeReg(0x7d,0,ram); // zero-delay = 4-byte echo ring
    dsp.writeReg(0x4d,0,ram);
    // The *internal* power-on value is $E0, but the externally readable
    // register memory is not initialized by IPL software and can read $00.
    assert(dsp.readReg(0x6c)==0);
    auto before=ram;
    dsp.processEcho(ram,1234,-2345);
    assert(ram==before); // no ARAM corruption before FLG is configured
    assert(dsp.echoHistoryPos==1); // reading/filter continue, even protected
    ++cases;
    // A real FLG write must override the internal boot value immediately.
    dsp.writeReg(0x6c,0,ram);
    assert(dsp.readReg(0x6c)==0);
    dsp.processEcho(ram,1234,-2345);
    assert(SpcDsp::readSigned16(ram,addr)==1234);
    assert(SpcDsp::readSigned16(ram,(addr+2)&65535u)==-2346);
    ++cases;
    // Echo write protection must not suppress reads, FIR or ring advance.
    dsp.writeReg(0x6c,0x20,ram);
    before=ram;
    const auto oldHistory=dsp.echoHistoryPos;
    dsp.processEcho(ram,9876,-9876);
    assert(ram==before && dsp.echoHistoryPos==((oldHistory+1)&7));
    ++cases;
    // Muting the output is not the same as disabling echo ARAM writes.
    dsp.writeReg(0x6c,0x40,ram);
    dsp.processEcho(ram,2346,-4321);
    assert(SpcDsp::readSigned16(ram,addr)==2346);
    assert(SpcDsp::readSigned16(ram,(addr+2)&65535u)==-4322);
    ++cases;
  }
  // Internal mute on reset is effective even when the readback is zero.
  for(unsigned page=0;page<32;page++){
    std::vector<std::uint8_t>ram(65536,0);
    SpcDsp dsp;dsp.hardwareEchoFir=true;dsp.echoRamWritesAllowed=false;
    dsp.writeReg(0x6d,std::uint8_t(page),ram);
    dsp.writeReg(0x7d,0,ram);
    dsp.writeReg(0x7f,127,ram);
    dsp.writeReg(0x2c,127,ram);dsp.writeReg(0x3c,127,ram);
    sample(ram,page*256u,8000,8000);
    const auto muted=dsp.renderSample(ram);
    assert(muted[0]==0 && muted[1]==0);
    dsp.writeReg(0x6c,0,ram);
    const auto audible=dsp.renderSample(ram);
    assert(audible[0]!=0 && audible[1]!=0);
    ++cases;
  }
  // Legacy remains compatible: its FLG behavior is not changed.
  for(unsigned page=0;page<32;page++){
    std::vector<std::uint8_t>ram(65536,0);
    SpcDsp dsp;dsp.hardwareEchoFir=false;dsp.echoRamWritesAllowed=true;
    dsp.writeReg(0x6d,std::uint8_t(page),ram);
    dsp.writeReg(0x7d,1,ram);
    dsp.processEcho(ram,4000,-4000);
    assert(SpcDsp::readSigned16(ram,page*256u)==4000);
    ++cases;
  }
  std::cout<<"DSP_FLG_INTERNAL_RESET_V043649_PASS cases="<<cases<<"\n";
}
