#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>
static void setup(SpcDsp&d,std::vector<std::uint8_t>&ram,unsigned num=1){
  ram[0x100]=0;ram[0x101]=2;ram[0x102]=0;ram[0x103]=2;
  ram[0x200]=0xB3; // BRR range 11, END+LOOP
  for(int k=0;k<8;k++)ram[0x201+k]=0x77;
  const auto w=[&](unsigned reg,unsigned val){d.writeReg((std::uint8_t)reg,(std::uint8_t)val,ram);};
  w(0x5d,1);w(0x0c,100);w(0x1c,100);
  for(unsigned i=0;i<num;i++){
    const unsigned b=i<<4;
    w(b|0x02,0);w(b|0x03,8);w(b|0,100);w(b|1,100);
    w(b|4,0);w(b|5,0);w(b|7,127);
  }
  w(0x4c,(1u<<num)-1u);
}
int main(){
  {
    // Regression: idle DSP echo must not corrupt memory when EON=EDL=0.
    SpcDsp d;std::vector<std::uint8_t>ram(65536,0x5a);
    d.writeReg(0x6d,0,ram);d.writeReg(0x7d,0,ram);
    d.renderSample(ram);
    assert(ram[0]==0x5a&&ram[1]==0x5a&&ram[2]==0x5a&&ram[3]==0x5a);
  }
  {
    // Echo delay reads and writes SPC RAM, FIR tap 0, and separate wet volumes.
    SpcDsp d;std::vector<std::uint8_t>ram(65536);
    setup(d,ram);
    d.writeReg(0x0c,0,ram);d.writeReg(0x1c,0,ram); // dry volume off
    d.writeReg(0x2c,127,ram);d.writeReg(0x3c,127,ram);
    d.writeReg(0x0f,127,ram);d.writeReg(0x4d,1,ram);
    d.writeReg(0x6d,0x50,ram);d.writeReg(0x7d,0,ram);
    auto first=d.renderSample(ram);
    assert(first[0]==0&&first[1]==0);
    assert(SpcDsp::readSigned16(ram,0x5000)>0);
    auto second=d.renderSample(ram);
    assert(second[0]>0&&second[1]>0);
    // Echo memory write inhibit must not block reading old echo samples.
    d.writeReg(0x6c,0x20,ram);
    const auto before0=ram[0x5000],before1=ram[0x5001];
    (void)d.renderSample(ram);
    assert(ram[0x5000]==before0&&ram[0x5001]==before1);
    d.writeReg(0x6c,0x60,ram); // mute + disable write, but DSP still clocks
    auto muted=d.renderSample(ram);
    assert(muted[0]==0&&muted[1]==0);
  }
  {
    SpcDsp d;std::vector<std::uint8_t>ram(65536);
    setup(d,ram);d.writeReg(0x6c,31,ram);
    SpcDsp clean=d;auto cleanRam=ram;
    d.writeReg(0x3d,1,ram); // noise oscillator for voice 0
    auto cleanSample=clean.renderSample(cleanRam);
    auto noise=d.renderSample(ram);
    assert(cleanSample[0]!=noise[0]); // noise differs from BRR at identical phase
    auto seed=d.noiseLfsr;
    for(int i=0;i<24;i++)d.renderSample(ram);
    assert(d.noiseLfsr!=seed);
  }
  {
    SpcDsp on,off;std::vector<std::uint8_t>ram1(65536),ram2(65536);
    setup(on,ram1,2);setup(off,ram2,2);
    on.writeReg(0x2d,2,ram1);
    (void)on.renderSample(ram1);(void)off.renderSample(ram2);
    assert(on.voice[1].phase!=off.voice[1].phase);
    assert(on.voice[0].phase==off.voice[0].phase);
  }
  std::cout<<"DSP v0.4.26: stereo echo/FIR, echo RAM flags, noise LFSR, PMON PASS\n";
}
