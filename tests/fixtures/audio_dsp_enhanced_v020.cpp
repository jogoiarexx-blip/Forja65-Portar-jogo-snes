#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <iostream>
int main(){
  SpcDsp d;std::vector<std::uint8_t> ram(65536,0);
  ram[0x100]=0;ram[0x101]=2;ram[0x102]=0;ram[0x103]=2;
  ram[0x200]=0xB3; // BRR range 11, end+loop
  for(int j=0;j<8;j++)ram[0x201+j]=(j&1)?0x77:0x37;
  auto reg=[&](unsigned addr,unsigned val){d.writeReg((std::uint8_t)addr,(std::uint8_t)val,ram);};
  reg(0x5d,1);reg(0x02,0);reg(0x03,0x08);reg(0x00,100);reg(0x01,50);
  reg(0x0c,100);reg(0x1c,100);reg(0x05,0);reg(0x07,0x7f);
  reg(0x4c,1);auto a=d.renderSample(ram);
  assert(d.voice[0].env==2032);
  assert(d.readReg(0x08)==127); // ENVX follows envelope
  assert(a[0]>0 && a[1]>0 && a[0]>a[1]);
  auto b=d.renderSample(ram);
  assert(b!=a); // interpolated fractional BRR movement
  // Fast ADSR attack now ramps from zero instead of always staying at full volume.
  reg(0x05,0x8f);reg(0x06,0xe0);reg(0x4c,1);
  assert(d.voice[0].env==0);
  d.renderSample(ram);
  assert(d.voice[0].env==1024 && d.voice[0].envStage==0);
  d.renderSample(ram);
  assert(d.voice[0].env==2047 && d.voice[0].envStage==1);
  // KOFF is an 8-unit per sample release, not an abrupt sound cutoff.
  reg(0x5c,1);
  d.renderSample(ram);
  assert(d.voice[0].active && d.voice[0].env==2039);
  for(int j=0;j<280;j++)d.renderSample(ram);
  assert(d.voice[0].active && d.voice[0].env==0); // END+LOOP continues silently after release
  // GAIN increase mode is stateful rather than a fixed placeholder.
  reg(0x05,0);reg(0x07,0xff);reg(0x4c,1);
  for(int j=0;j<3;j++)d.renderSample(ram);
  assert(d.voice[0].env>0);
  // Mute must silence PCM but permit envelope and BRR clocking.
  reg(0x6c,0x40);const auto phase=d.voice[0].phase;
  assert(d.renderSample(ram)[0]==0);
  assert(d.voice[0].phase!=phase);
  std::cout<<"DSP v0.4.25: ADSR, GAIN, release, BRR interpolation, stereo and mute PASS\n";
}
