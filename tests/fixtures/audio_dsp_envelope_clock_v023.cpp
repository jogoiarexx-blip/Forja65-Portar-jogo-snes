#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>

int main(){
  // Exact offset schedule in 32-kHz sample clocks; the scheduler is shared.
  const unsigned first[6]={2048,1040,536,1024,272,536};
  for(unsigned rate=1;rate<=6;rate++){
    SpcDsp d;
    for(unsigned n=1;n<first[rate-1];n++){
      d.clockEnvelopeCounter();assert(!d.envelopeRateEvent(rate));
    }
    d.clockEnvelopeCounter();assert(d.envelopeRateEvent(rate));
  }
  SpcDsp d;std::vector<std::uint8_t> ram(65536);
  auto wr=[&](unsigned a,unsigned v){d.writeReg(std::uint8_t(a),std::uint8_t(v),ram);};
  d.voice[0].active=d.voice[1].active=true;
  wr(0x05,0x80); // ADSR attack rate 1: first event at sample 2048.
  wr(0x15,0);wr(0x17,0xC2); // GAIN linear increase rate 2: first event at 1040.
  for(unsigned n=1;n<=2048;n++){
    d.clockEnvelopeCounter();d.stepEnvelope(0);d.stepEnvelope(1);
    if(n<1040)assert(d.voice[1].env==0);
    if(n==1040)assert(d.voice[1].env==32);
    if(n<2048)assert(d.voice[0].env==0);
  }
  assert(d.voice[0].env==32);
  // Hardware exponential decrease first subtracts 1, then the shifted envelope.
  d.envelopeClock=1;d.voice[0].env=0x300;d.voice[0].envStage=2;
  wr(0x05,0x80);wr(0x06,0xFF); // sustain rate 31
  d.clockEnvelopeCounter();d.stepEnvelope(0);
  assert(d.voice[0].env==0x2FD); // (0x300-1) - ((0x300-1)>>8)
  // GAIN exponential decrease uses exactly the same hardware curve.
  wr(0x05,0);wr(0x07,0xBF);d.voice[0].env=0x100;
  d.clockEnvelopeCounter();d.stepEnvelope(0);
  assert(d.voice[0].env==0xFF);
  // Rate zero never changes the visible envelope even after many clocks.
  wr(0x07,0xC0);d.voice[0].env=0x222;
  for(unsigned n=0;n<4000;n++){d.clockEnvelopeCounter();d.stepEnvelope(0);}
  assert(d.voice[0].env==0x222);
  // Bent-line GAIN switches to +8 when hidden ENV was already >=0x600.
  wr(0x07,0xFF);d.voice[0].env=0x5ff;d.voice[0].hiddenEnv=0x600;
  d.clockEnvelopeCounter();d.stepEnvelope(0);assert(d.voice[0].env==0x607);
  // Release ignores the event clock and counts down by 8 each sample.
  d.voice[0].releasing=true;d.voice[0].env=16;
  d.clockEnvelopeCounter();d.stepEnvelope(0);assert(d.voice[0].env==8);
  d.clockEnvelopeCounter();d.stepEnvelope(0);assert(d.voice[0].active && d.voice[0].env==0); // silent release still processes BRR/ENDX
  // All earlier envelope arithmetic is still selectable for compatibility.
  SpcDsp legacy;legacy.hardwareEnvelopeTiming=false;
  legacy.voice[0].active=true;
  legacy.writeReg(0x05,0x8f,ram);legacy.writeReg(0x06,0xe0,ram);
  legacy.clockEnvelopeCounter();legacy.stepEnvelope(0);
  assert(legacy.voice[0].env==0x400);
  std::cout<<"DSP clock + ADSR/GAIN + release + legacy fallback PASS\n";
}
