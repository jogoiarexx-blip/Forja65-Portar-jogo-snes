#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>

static void sound(ApuBridge& a){
  a.setNativeDsp(true);
  a.enableMemoryPcmCapture(true);
  a.dsp.hardwareKeyTiming=true;
  a.spc.ram[0x100]=0x00;a.spc.ram[0x101]=0x02;
  a.spc.ram[0x102]=0x00;a.spc.ram[0x103]=0x02;
  a.spc.ram[0x200]=0x03;
  for(unsigned i=0;i<8;i++)a.spc.ram[0x201+i]=0x77;
  auto wr=[&](unsigned r,unsigned v){a.dsp.writeReg((std::uint8_t)r,(std::uint8_t)v,a.spc.ram);};
  wr(0x5d,1);wr(0x00,127);wr(0x01,127);
  wr(0x02,0);wr(0x03,0x10);wr(0x05,0x8f);
  wr(0x0c,127);wr(0x1c,127);wr(0x4c,1);
}
int main(){
  static_assert(ApuBridge::DSP_MASTER_HZ==21477272ull);
  static_assert(ApuBridge::DSP_OUTPUT_RATE_HZ==32000ull);
  ApuBridge a,b; sound(a);sound(b);
  assert(!a.legacyDspClock && !b.legacyDspClock);
  a.tickDspMasterCycles(670);
  assert(a.dspNativeSamples==0);
  a.tickDspMasterCycles(1);
  assert(a.dspNativeSamples==0); // 671 master ticks still below one nominal 32 kHz period
  a.tickDspMasterCycles(1);
  assert(a.dspNativeSamples==1);
  a.tickDspMasterCycles((unsigned)ApuBridge::DSP_MASTER_HZ-672);
  assert(a.dspNativeSamples==32000);
  assert(a.dspMasterRemainder==0);
  const auto total=(unsigned)ApuBridge::DSP_MASTER_HZ;
  std::uint64_t fed=0;
  while(fed<total){
    const auto step=(unsigned)std::min<std::uint64_t>(total-fed,1u+((fed*17u+37u)%9917u));
    b.tickDspMasterCycles(step);fed+=step;
  }
  assert(b.dspNativeSamples==a.dspNativeSamples);
  assert(a.nativePcm==b.nativePcm);
  assert(a.dspMasterRemainder==b.dspMasterRemainder);
  bool soundPresent=false;
  for(const auto sample:a.nativePcm)if(sample){soundPresent=true;break;}
  assert(soundPresent);
  // Fractional clock must retain the same timeline whether DSP rendering is
  // enabled or disabled; fallback still advances the output sample counter.
  ApuBridge silent;silent.tickDspMasterCycles(total);
  assert(silent.dspFallbackSamples==32000);
  assert(silent.dspMasterRemainder==0);
  // Old cadence can still be selected explicitly for golden/replay comparisons.
  ApuBridge old;old.legacyDspClock=true;
  old.tickDspMasterCycles(total);
  assert(old.dspFallbackSamples==total/ApuBridge::DSP_SAMPLE_MASTER_CYCLES);
  assert(old.dspFallbackSamples>silent.dspFallbackSamples);
  std::cout<<"DSP_FRACTIONAL_CLOCK_PASS exact_1s="<<a.dspNativeSamples
    <<" legacy="<<old.dspFallbackSamples<<" splits=deterministic pcm=nonzero\n";
}
