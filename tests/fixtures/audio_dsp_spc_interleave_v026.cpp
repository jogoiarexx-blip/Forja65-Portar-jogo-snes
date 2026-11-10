#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <algorithm>
#include <cstdint>
#include <iostream>
#include <vector>

static void note(ApuBridge& a){
  a.setNativeDsp(true);a.enableMemoryPcmCapture(true);
  a.dsp.interpolation=SpcDsp::Interpolation::Linear;
  a.spc.ram[0x100]=0x00;a.spc.ram[0x101]=0x02;
  a.spc.ram[0x102]=0x00;a.spc.ram[0x103]=0x02;
  a.spc.ram[0x200]=0x03;
  for(unsigned i=0;i<8;i++)a.spc.ram[0x201+i]=0x77;
  auto wr=[&](unsigned r,unsigned v){a.dsp.writeReg((std::uint8_t)r,(std::uint8_t)v,a.spc.ram);};
  wr(0x5d,1);wr(0x00,127);wr(0x01,127);
  wr(0x02,0);wr(0x03,0x10);wr(0x05,0x8f);
  wr(0x0c,127);wr(0x1c,127);wr(0x4c,1);
}
// Deliberately change the FLG mute bit at an exact master-clock boundary.
// A monolithic host tick cannot place this between two DSP samples without
// interleaving, while a chronological tick can.
static void timedMute(ApuBridge& a,unsigned){
  constexpr std::uint64_t threshold=40ull*672ull;
  if(a.nativeMasterCycles>=threshold && !(a.dsp.regs[0x6c]&0x40))
    a.dsp.writeReg(0x6c,0x40,a.spc.ram);
}
static bool nonzero(const std::vector<std::int16_t>&v,std::size_t first,std::size_t last){
  for(std::size_t i=first;i<last && i<v.size();i++)if(v[i])return true;
  return false;
}
int main(){
  // A single large call and 80 smaller (one-sample-period) calls must produce
  // the same PCM when the register event happens between sample 39 and 40.
  ApuBridge whole,chunked,legacy;
  for(auto* a:{&whole,&chunked,&legacy}){
    note(*a);a->setNativeStepHook(timedMute);
    a->interleaveSpcDsp=(a!=&legacy);
  }
  constexpr unsigned count=80*672;
  whole.tickMasterCycles(count);
  for(unsigned n=0;n<80;n++)chunked.tickMasterCycles(672);
  legacy.tickMasterCycles(count);
  assert(whole.dspNativeSamples==chunked.dspNativeSamples);
  assert(whole.nativePcm==chunked.nativePcm);
  assert(whole.dspMasterRemainder==chunked.dspMasterRemainder);
  assert(whole.dspInterleaveSlices>70 && chunked.dspInterleaveSlices>70);
  assert(nonzero(whole.nativePcm,4,30*2));
  assert(!nonzero(whole.nativePcm,42*2,whole.nativePcm.size()));
  assert(!nonzero(legacy.nativePcm,0,legacy.nativePcm.size()));
  assert(whole.masterObserved==count&&chunked.masterObserved==count);
  // Fractional master clock and the legacy 671-cycle clock are both supported.
  ApuBridge old;old.legacyDspClock=true;old.interleaveSpcDsp=true;
  old.tickMasterCycles(6710);
  assert(old.dspFallbackSamples==10);
  // Zero-length input must not process SPC opcodes or synthesize audio.
  const auto before=whole.dspInterleaveSlices;
  whole.tickMasterCycles(0);
  assert(whole.dspInterleaveSlices==before);
  std::cout<<"DSP_SPC_INTERLEAVE_V0431_PASS stereo="<<whole.dspNativeSamples
           <<" slices="<<whole.dspInterleaveSlices<<" split=identical mute_boundary=preserved\n";
}
