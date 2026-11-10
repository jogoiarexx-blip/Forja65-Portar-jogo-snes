#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>

static void configure(ApuBridge &apu, unsigned page) {
  apu.setNativeDsp(true);
  apu.dsp.hardwareEchoFir=true;
  auto &ram=apu.spc.ram;
  apu.dsp.writeReg(0x6d,std::uint8_t(page),ram);
  apu.dsp.writeReg(0x7d,0,ram);
  apu.dsp.writeReg(0x4d,0,ram);
  apu.dsp.writeReg(0x0d,0,ram);
  apu.dsp.writeReg(0x6c,0,ram);
  SpcDsp::writeSigned16(ram,page<<8,8000);
  SpcDsp::writeSigned16(ram,(page<<8)+2,-8000);
}
int main() {
  unsigned cases=0;
  // First sample ends at master 672. Phase 28 is master 588; 29 is 609.
  for(unsigned page=0;page<256;page++)for(unsigned mask=0;mask<4;mask++) {
    ApuBridge a;configure(a,page);
    const bool left=(mask&1)!=0,right=(mask&2)!=0;
    // Explicit event timestamps supplied by an integrator with true clocks.
    assert(a.scheduleEchoProtectionAtMaster(0,!left));
    assert(a.scheduleEchoProtectionAtMaster(600,!right));
    a.tickDspMasterCycles(672);
    assert(a.dspNativeSamples==1 && a.dspSampleOrdinal==1);
    assert(SpcDsp::readSigned16(a.spc.ram,page<<8)==(left?0:8000));
    assert(SpcDsp::readSigned16(a.spc.ram,(page<<8)+2)==(right?0:-8000));
    assert(a.timedEchoProtection.empty());
    assert(!a.dsp.echoProtectionOverrideEnabled);
    assert(a.dsp.echoHistoryPos==1);
    ++cases;
  }
  // Important boundaries: an event at phase28 affects both channels,
  // an event after phase29 affects neither channel of this sample.
  for(unsigned transition:{587u,588u,589u,609u,610u,671u}){
    ApuBridge a;configure(a,0x3a);
    assert(a.scheduleEchoProtectionAtMaster(0,true));
    assert(a.scheduleEchoProtectionAtMaster(transition,false));
    a.tickDspMasterCycles(672);
    const bool left=transition<=588u,right=transition<=609u;
    assert(SpcDsp::readSigned16(a.spc.ram,0x3a00)==(left?0:8000));
    assert(SpcDsp::readSigned16(a.spc.ram,0x3a02)==(right?0:-8000));
    ++cases;
  }
  // Host chunk invariance across fractional sample time and two samples.
  for(unsigned mask=0;mask<4;mask++){
    ApuBridge bulk,chunk;configure(bulk,0x1f);configure(chunk,0x1f);
    const bool init=(mask&1)!=0,last=(mask&2)!=0;
    for(auto *a:{&bulk,&chunk}){
      assert(a->scheduleEchoProtectionAtMaster(0,init));
      assert(a->scheduleEchoProtectionAtMaster(600,last));
      assert(a->scheduleEchoProtectionAtMaster(675,!last));
      assert(a->scheduleEchoProtectionAtMaster(1300,last));
    }
    bulk.tickDspMasterCycles(1344);
    for(unsigned t=0;t<1344;t++)chunk.tickDspMasterCycles(1);
    assert(bulk.spc.ram==chunk.spc.ram);
    assert(bulk.dspNativeSamples==chunk.dspNativeSamples && bulk.dspNativeSamples==2);
    assert(bulk.dsp.echoHistoryPos==chunk.dsp.echoHistoryPos);
    assert(bulk.timedEchoProtection.empty()&&chunk.timedEchoProtection.empty());
    ++cases;
  }
  // Reject time travel and unordered events, without corrupting the queue.
  {
    ApuBridge a;configure(a,0x30);
    assert(a.scheduleEchoProtectionAtMaster(800,true));
    assert(!a.scheduleEchoProtectionAtMaster(799,false));
    assert(a.timedEchoProtection.size()==1);
    a.tickDspMasterCycles(672);
    assert(!a.scheduleEchoProtectionAtMaster(671,false));
    assert(a.scheduleEchoProtectionAtMaster(900,false));
    assert(a.timedEchoProtection.size()==2);
    ++cases;
  }
  // Zero instrumentation: preexisting full-sample DSP behavior is unchanged.
  {
    ApuBridge a;configure(a,0x44);
    a.tickDspMasterCycles(672);
    assert(SpcDsp::readSigned16(a.spc.ram,0x4400)==0);
    assert(SpcDsp::readSigned16(a.spc.ram,0x4402)==0);
    assert(!a.timedEchoEnabled);
    ++cases;
  }
  // Legacy DSP profile: no phase callback should be activated.
  {
    ApuBridge a;configure(a,0x33);
    a.dsp.hardwareEchoFir=false;
    a.dsp.writeReg(0x7d,1,a.spc.ram);
    assert(a.scheduleEchoProtectionAtMaster(0,true));
    a.tickDspMasterCycles(672);
    assert(!a.dsp.echoProtectionOverrideEnabled);
    ++cases;
  }
  std::cout<<"DSP_TIMESTAMPED_ECHO_GATE_V043651_PASS cases="<<cases<<"\n";
}
