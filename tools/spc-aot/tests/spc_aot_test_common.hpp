#pragma once
#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstring>
static void equal(const ApuBridge&a,const ApuBridge&b){
 assert(a.spc.ram==b.spc.ram);assert(a.spc.pc==b.spc.pc);assert(a.spc.ya==b.spc.ya);
 assert(a.spc.x==b.spc.x&&a.spc.sp==b.spc.sp&&a.spc.psw==b.spc.psw);
 assert(a.spc.control==b.spc.control&&a.spc.dspAddr==b.spc.dspAddr);
 assert(!std::memcmp(a.spc.dsp,b.spc.dsp,sizeof(a.spc.dsp)));
 assert(!std::memcmp(a.spc.portIn,b.spc.portIn,sizeof(a.spc.portIn)));
 assert(!std::memcmp(a.spc.portOut,b.spc.portOut,sizeof(a.spc.portOut)));
 assert(!std::memcmp(a.spc.timerOut,b.spc.timerOut,sizeof(a.spc.timerOut)));
 assert(!std::memcmp(a.spc.timerTarget,b.spc.timerTarget,sizeof(a.spc.timerTarget)));
 assert(!std::memcmp(a.spc.timerDiv,b.spc.timerDiv,sizeof(a.spc.timerDiv)));
 assert(!std::memcmp(a.spc.timerStage,b.spc.timerStage,sizeof(a.spc.timerStage)));
 assert(!std::memcmp(a.spc.timersOn,b.spc.timersOn,sizeof(a.spc.timersOn)));
 assert(a.keyOn==b.keyOn&&a.keyOff==b.keyOff);
 for(unsigned i=0;i<128;i++)assert(a.dsp.readReg(i)==b.dsp.readReg(i));
 assert(a.nativePcm==b.nativePcm&&a.dspNativeSamples==b.dspNativeSamples);
 assert(a.spcMasterRemainder==b.spcMasterRemainder&&a.dspMasterRemainder==b.dspMasterRemainder);
}
