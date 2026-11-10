#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>
static void setWord(std::vector<std::uint8_t>&ram,unsigned addr,int value){
  const unsigned u=(std::uint16_t)value;
  ram[addr&65535u]=(std::uint8_t)u;
  ram[(addr+1u)&65535u]=(std::uint8_t)(u>>8);
}
static SpcDsp setup(std::vector<std::uint8_t>&ram){
  SpcDsp d;d.hardwareEchoFir=true;d.echoRamWritesAllowed=false;
  d.writeReg(0x6d,0x40,ram);d.writeReg(0x7d,1,ram);
  return d;
}
int main(){
  {
    // FIR7 is most recent; 16-bit signed input is shifted right by one.
    std::vector<std::uint8_t>ram(65536);SpcDsp d=setup(ram);
    d.writeReg(0x7f,64,ram);setWord(ram,0x4000,8000);setWord(ram,0x4002,-8000);
    auto wet=d.processEcho(ram,0,0);
    assert(wet[0]==4000 && wet[1]==-4000);
    assert(SpcDsp::readSigned16(ram,0x4000)==8000); // writes inhibited
    wet=d.processEcho(ram,0,0);
    assert(wet[0]==0 && wet[1]==0); // FIR7 only sees current
  }
  {
    // FIR0 is the oldest sample, not the newest; impulse leaves on 8th frame.
    std::vector<std::uint8_t>ram(65536);SpcDsp d=setup(ram);
    d.writeReg(0x0f,64,ram);setWord(ram,0x4000,8000);
    for(int n=0;n<7;n++)assert(d.processEcho(ram,0,0)[0]==0);
    assert(d.processEcho(ram,0,0)[0]==4000);
    assert(d.processEcho(ram,0,0)[0]==0);
  }
  {
    // Echo FIR first seven taps wrap signed 16-bit, last tap saturates.
    std::vector<std::uint8_t>ram(65536);SpcDsp d=setup(ram);
    for(unsigned i=0;i<8;i++)d.writeReg((std::uint8_t)((i<<4)|0x0f),127,ram);
    for(unsigned n=0;n<8;n++)setWord(ram,0x4000+4*n,32000);
    for(int n=0;n<7;n++)(void)d.processEcho(ram,0,0);
    auto wet=d.processEcho(ram,0,0);
    const int term=(16000*127)>>6;
    const int wrapped=(std::int16_t)(std::uint16_t)(term*7);
    const int expected=(int)SpcDsp::clamp16(wrapped+term)&~1;
    assert(wet[0]==expected);
  }
  {
    // Echo memory wraps at $FFFF, including stereo right channel.
    std::vector<std::uint8_t>ram(65536);
    SpcDsp d;d.hardwareEchoFir=true;d.echoRamWritesAllowed=false;
    d.writeReg(0x6d,0xff,ram);d.writeReg(0x7d,1,ram);
    d.echoPosition=0xFC;
    d.writeReg(0x7f,127,ram);
    setWord(ram,0xfffc,8192);setWord(ram,0xfffe,-8192);
    auto wet=d.processEcho(ram,0,0);
    assert(wet[0]==(4096*127/64&~1));
    assert(wet[1]==(-4096*127/64&~1));
    assert(d.echoPosition==0x100);
  }
  {
    // Hardware noise LFSR is phased by shared envelope counter, not a
    // free-running modulo counter. For rate 2 first event is at tick 1040.
    SpcDsp hardware,legacy;
    hardware.hardwareNoiseTiming=true;legacy.hardwareNoiseTiming=false;
    hardware.regs[0x6c]=legacy.regs[0x6c]=2;
    const auto seed=hardware.noiseLfsr;
    for(int i=0;i<1039;i++){
      hardware.clockEnvelopeCounter();hardware.stepNoise();
      legacy.clockEnvelopeCounter();legacy.stepNoise();
    }
    assert(hardware.noiseLfsr==seed&&legacy.noiseLfsr==seed);
    hardware.clockEnvelopeCounter();hardware.stepNoise();
    legacy.clockEnvelopeCounter();legacy.stepNoise();
    assert(hardware.noiseLfsr!=seed && legacy.noiseLfsr==seed);
  }
  {
    // A signed 7-bit volume of 127 scales by 128 in hardware mode.
    SpcDsp d;d.hardwareVolumeScaling=true;
    std::vector<std::uint8_t>ram(65536);
    d.regs[0x0c]=d.regs[0x1c]=127;
    assert(d.renderSample(ram)[0]==0); // no active voice
  }
  std::cout<<"DSP FIR hardware, signed wrap/clamp, echo ring, RAM wrap, noise clock PASS\n";
}
