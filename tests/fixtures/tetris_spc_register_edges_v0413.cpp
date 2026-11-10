#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <iostream>
static void check(bool accurate){
  ApuBridge a;
  a.accurateSpcTiming=accurate;
  a.spcWrite(0xF2,0xAD); // DSP register $2D with read-only bit set
  assert(a.spc.dspAddr==0xAD);
  assert(a.spcRead(0xF2)==0xAD); // S-SMP DSPADDR preserves all eight latch bits
  assert(forja65SpcPeek(a,0xF2)==0xAD); // Scheduler inspection is consistent
  a.spcWrite(0xF3,0x5A); // DSP writes blocked while bit 7 set
  assert(a.dsp.readReg(0x2D)==0);
  a.spcWrite(0xF2,0x2D);
  a.spcWrite(0xF3,0x5A);
  assert(a.dsp.readReg(0x2D)==0x5A);
  a.spcWrite(0xF1,0x04); // Off -> on must reset the stage and output
  a.spc.timerStage[2]=7;a.spc.timerOut[2]=5;a.spc.timerDiv[2]=11;
  a.spcWrite(0xF1,0x04); // Still enabled: NO reset
  assert(a.spc.timerStage[2]==7 && a.spc.timerOut[2]==5);
  assert(a.spc.timerDiv[2]==11);
  a.spcWrite(0xF1,0x00); // Disable
  a.spcWrite(0xF1,0x04); // Re-enable: reset only stage/out
  assert(a.spc.timerStage[2]==0 && a.spc.timerOut[2]==0);
  if(accurate) assert(a.spc.timerDiv[2]==11); // free-running divider in accurate mode
  else assert(a.spc.timerDiv[2]==0); // prior legacy behavior retained
  a.spcWrite(0xF1,0x04); // Again: no reset
  a.spc.timerStage[2]=6;a.spc.timerOut[2]=3;
  a.spcWrite(0xF1,0x04);
  assert(a.spc.timerStage[2]==6 && a.spc.timerOut[2]==3);
}
int main(){check(false);check(true);std::cout<<"SPC_APU_EDGE_REGRESSION_PASS modes=2 F2_readback=full8 F3_write=gate F1_restart=rising-edge\n";}
