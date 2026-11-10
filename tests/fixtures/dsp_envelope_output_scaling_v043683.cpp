#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>
#include <algorithm>

static int oracle(int pcm,int env){
  // Independent integer specification: floor(pcm * ENV / 2048), even output.
  const std::int64_t product=std::int64_t(pcm)*env;
  const std::int64_t rounded=product>=0?product/2048:-((-product+2047)/2048);
  return int(rounded)&~1;
}
int main(){
  unsigned long long checks=0;
  const int samples[]={-32768,-32767,-30000,-2049,-2048,-2047,-1025,-1024,-1023,-9,-8,-7,-3,-2,-1,0,1,2,3,7,8,9,1023,1024,1025,2047,2048,2049,30000,32766,32767};
  for(int env=0;env<=2047;env++)for(int pcm:samples){
    assert(SpcDsp::applyEnvelopeHardware(pcm,env)==oracle(pcm,env));
    ++checks;
  }
  // Full 15-bit noise oscillator space with representative envelope values.
  for(unsigned code=0;code<32768;code++){
    const int pcm=code<16384?int(code)*2:int(code)*2-65536;
    const int env=int((code*181u)&2047u);
    assert(SpcDsp::applyEnvelopeHardware(pcm,env)==oracle(pcm,env));
    ++checks;
  }
  // Byte-visible OUTX, actual nextSample path, all voices and GAIN levels.
  // Fixed GAIN is clocked every sample; pitch 0 holds sample position.
  std::vector<std::uint8_t> ram(65536);
  for(unsigned voice=0;voice<8;voice++)for(unsigned gain=0;gain<128;gain++)
  for(int pcm: samples){
    SpcDsp d;
    d.hardwareEnvelopeOutput=true;
    d.interpolation=SpcDsp::Interpolation::Linear;
    auto&v=d.voice[voice];v.active=true;v.blockPos=0;v.phase=0;
    v.decoded[0]=std::int16_t(pcm);
    d.regs[(voice<<4)|7]=std::uint8_t(gain); // fixed 7-bit GAIN
    const int out=d.nextSample(voice,ram);
    const int expected=oracle(pcm,int(gain)*16);
    assert(out==expected);
    assert(d.regs[(voice<<4)|9]==std::uint8_t(std::int16_t(expected)>>8));
    ++checks;
    if(gain%16==0){
      // Legacy mode still produces the original /2047 result.
      SpcDsp legacy;
      legacy.hardwareEnvelopeOutput=false;
      legacy.interpolation=SpcDsp::Interpolation::Linear;
      auto&old=legacy.voice[voice];old.active=true;old.blockPos=0;old.decoded[0]=std::int16_t(pcm);
      legacy.regs[(voice<<4)|7]=std::uint8_t(gain);
      assert(legacy.nextSample(voice,ram)==pcm*int(gain*16)/2047);
      ++checks;
    }
  }
  // Noise bypass: uses the same envelope arithmetic independent of BRR bytes.
  for(unsigned voice=0;voice<8;voice++)for(unsigned n=0;n<256;n++){
    SpcDsp d; d.hardwareEnvelopeOutput=true; d.interpolation=SpcDsp::Interpolation::Linear;
    d.voice[voice].active=true; d.voice[voice].blockPos=0;d.regs[0x3d]=std::uint8_t(1u<<voice);
    d.noiseLfsr=std::uint16_t((n*113u)&0x7fffu);
    d.regs[(voice<<4)|7]=std::uint8_t(n&127u);
    const int expected=oracle(d.noiseSample(),int(n&127u)*16);
    assert(d.nextSample(voice,ram)==expected);++checks;
  }
  std::cout<<"DSP_ENVELOPE_OUTPUT_V043683_PASS checks="<<checks<<"\n";
}
