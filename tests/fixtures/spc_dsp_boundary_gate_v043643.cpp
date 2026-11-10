#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <algorithm>
#include <cstdint>
#include <iostream>
#include <vector>

static void setup(ApuBridge& a,bool interleave,bool accurate,bool ntsc,bool strict){
  a.spc.control=0;
  a.spc.pc=0x0200;
  a.spc.dspAddr=0x6c; // FLG register, with mute bit initially clear
  a.accurateSpcTiming=accurate;
  a.ntscSpcClock=ntsc;
  a.strictSpcScheduler=strict;
  a.interleaveSpcDsp=interleave;
  for(unsigned i=0;i<14;++i)a.spc.ram[0x200+i]=0x00; // fourteen two-cycle NOPs
  a.spc.ram[0x20e]=0x8f; // MOV $F3,#$40 (five SPC cycles)
  a.spc.ram[0x20f]=0x40;
  a.spc.ram[0x210]=0xf3;
  a.spc.ram[0x211]=0xff; // STOP
  a.setNativeDsp(true);
  a.enableMemoryPcmCapture(true);
}
static void same(const ApuBridge& a,const ApuBridge& b){
  assert(a.spc.pc==b.spc.pc);
  assert(a.spcExecutedCycles==b.spcExecutedCycles);
  assert(a.dsp.regs[0x6c]==b.dsp.regs[0x6c]);
  assert(a.spcMasterRemainder==b.spcMasterRemainder);
  assert(a.ntscCycleCredit==b.ntscCycleCredit);
  assert(a.dspMasterRemainder==b.dspMasterRemainder);
  assert(a.dspNativeSamples==b.dspNativeSamples);
  assert(a.nativePcm==b.nativePcm);
}
int main(){
  unsigned cases=0;
  // Regression: 672 master ticks ~= 32 SPC cycles. After 14 NOPs the
  // five-cycle DSP register write must NOT be observable yet (needs 33).
  for(bool ntsc:{false,true}){
    ApuBridge gated,reference,ungated;
    setup(gated,true,true,ntsc,false);
    setup(reference,true,true,ntsc,true);
    setup(ungated,false,true,ntsc,false);
    gated.tickMasterCycles(672);
    reference.tickMasterCycles(672);
    ungated.tickMasterCycles(672);
    assert(gated.spc.pc==0x20e && gated.spcExecutedCycles==28);
    assert((gated.dsp.regs[0x6c]&0x40u)==0);
    assert(gated.spc.pc==reference.spc.pc);
    assert(gated.spcExecutedCycles==reference.spcExecutedCycles);
    assert(ungated.spc.pc==0x211 && (ungated.dsp.regs[0x6c]&0x40u));
    gated.tickMasterCycles(105);
    assert(gated.spc.pc>=0x211 && (gated.dsp.regs[0x6c]&0x40u));
    ++cases;
  }
  // A chronologically scheduled SPC/DSP run must not change when CPU or DMA
  // submits the same elapsed master-clock time in differently sized pieces.
  for(bool ntsc:{false,true})for(unsigned total:{1u,41u,671u,672u,700u,1344u,6710u}){
    ApuBridge whole,chunked;
    setup(whole,true,true,ntsc,false);setup(chunked,true,true,ntsc,false);
    whole.tickMasterCycles(total);
    unsigned left=total,seed=1;
    while(left){unsigned step=std::min(left,1u+(seed++*13u)%137u);chunked.tickMasterCycles(step);left-=step;}
    same(whole,chunked);
    ++cases;
  }
  // Explicit strict profile remains identical regardless of the DSP bridge.
  for(bool ntsc:{false,true}){
    ApuBridge strictInterleave,strictNoInterleave;
    setup(strictInterleave,true,true,ntsc,true);
    setup(strictNoInterleave,false,true,ntsc,true);
    strictInterleave.tickMasterCycles(672);
    strictNoInterleave.tickMasterCycles(672);
    assert(strictInterleave.spc.pc==strictNoInterleave.spc.pc);
    assert(strictInterleave.spcExecutedCycles==strictNoInterleave.spcExecutedCycles);
    ++cases;
  }
  // Legacy fixed-2-cycle SPC scheduling is deliberately not changed by the
  // new accurate-only instruction-completion gate.
  for(bool interleave:{false,true}){
    ApuBridge a; setup(a,interleave,false,false,false);
    a.tickMasterCycles(672);
    assert(a.spc.pc==0x212 && a.spc.stopped);
    ++cases;
  }
  std::cout<<"SPC_DSP_BOUNDARY_GATE_V043643_PASS cases="<<cases
           <<" premature_flg_write=prevented pcm_split=identical legacy=preserved\n";
}
