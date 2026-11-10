#include "runtime.hpp"
#include <cassert>
#include <chrono>
#include <cstdint>
#include <iostream>
#include <limits>

// Deliberately simple, independent old step-by-step implementation. Only
// bounded inputs are sent here; large elapsed values use batch invariance.
static void referenceAdvance(ApuBridge& s, unsigned cycles){
  for(int i=0;i<3;++i){
    const int period=i==2?16:128;
    const std::uint64_t elapsed=(std::uint64_t)s.spc.timerDiv[i]+cycles;
    const std::uint64_t ticks=elapsed/period;
    s.spc.timerDiv[i]=(int)(elapsed%period);
    if(!s.spc.timersOn[i])continue;
    for(std::uint64_t t=0;t<ticks;++t){
      s.spc.timerStage[i]=(s.spc.timerStage[i]+1)&255;
      if(s.spc.timerStage[i]==s.spc.timerTarget[i]){
        s.spc.timerStage[i]=0;
        s.spc.timerOut[i]=(s.spc.timerOut[i]+1)&15;
      }
    }
  }
}
static void same(const ApuBridge& a,const ApuBridge& b){
  for(int i=0;i<3;++i){
    assert(a.spc.timerDiv[i]==b.spc.timerDiv[i]);
    assert(a.spc.timerStage[i]==b.spc.timerStage[i]);
    assert(a.spc.timerOut[i]==b.spc.timerOut[i]);
  }
}
static std::uint32_t seed=0x31415926u;
static unsigned next(){seed^=seed<<13;seed^=seed>>17;seed^=seed<<5;return seed;}
static void init(ApuBridge& s,unsigned target,unsigned stage,unsigned initialDiv,unsigned timer,unsigned active,unsigned output){
  for(int i=0;i<3;++i){
    s.spc.timerTarget[i]=(std::uint8_t)((target+i*83u)&255u);
    s.spc.timerStage[i]=(int)((stage+i*67u)&255u);
    s.spc.timerDiv[i]=(int)((initialDiv+i*13u)%(i==2?16:128));
    s.spc.timersOn[i]=(i==(int)timer)?active!=0:(i%2==0);
    s.spc.timerOut[i]=(std::uint8_t)((output+i*7u)&15u);
  }
}
int main(){
  std::uint64_t bounded=0, split=0, massive=0;
  // Every combination of target/stage, especially target lowered BELOW an
  // already active stage. Check the original transition, not just modulo math.
  for(unsigned target=0;target<256;++target)for(unsigned stage=0;stage<256;++stage){
    ApuBridge a,b;
    init(a,target,stage,(target^stage)&127u,(target+stage)%3u,(target^stage)&1u,stage&15u);
    b=a;
    const unsigned cycles=((target*19u+stage*73u)%6000u);
    referenceAdvance(a,cycles);
    forja65AdvanceSpcTimers(b,cycles);
    same(a,b);++bounded;
  }
  // Longer sequences with live target changes, enable/disable transitions
  // and changing durations: test across all three prescaler periods.
  for(unsigned sequence=0;sequence<5000;++sequence){
    ApuBridge a,b;
    init(a,next()&255u,next()&255u,next()&127u,next()%3u,next()&1u,next()&15u);
    b=a;
    for(int step=0;step<6;++step){
      const unsigned cycles=next()%18000u;
      const unsigned i=next()%3u;
      if(step%2==0){
        a.spc.timerTarget[i]=b.spc.timerTarget[i]=(std::uint8_t)next();
        a.spc.timersOn[i]=b.spc.timersOn[i]=bool(next()&1u);
      }
      referenceAdvance(a,cycles);
      forja65AdvanceSpcTimers(b,cycles);
      same(a,b);++bounded;
    }
  }
  // Large input previously converted unsigned->signed and overflowed the
  // signed timer prescaler. One huge call must equal many safe chunks.
  for(unsigned trial=0;trial<200;++trial){
    ApuBridge one,many;
    init(one,next()&255u,next()&255u,next()&127u,next()%3u,next()&1u,next()&15u);
    many=one;
    const unsigned total=std::numeric_limits<unsigned>::max()-trial*351u;
    const auto begin=std::chrono::steady_clock::now();
    forja65AdvanceSpcTimers(one,total);
    const auto elapsed=std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now()-begin).count();
    // Guard catastrophic O(ticks) accidentally reintroduced. 250 ms per
    // call is deliberately generous even for unoptimized Linux/Windows.
    assert(elapsed<250);
    unsigned remaining=total;
    while(remaining){
      const unsigned chunk=std::min(remaining,((next()&0x7fffffu)+1u));
      forja65AdvanceSpcTimers(many,chunk);
      remaining-=chunk;
    }
    same(one,many);++massive;
  }
  // Batches can be arbitrarily split without advancing disabled timers.
  for(unsigned trial=0;trial<10000;++trial){
    ApuBridge one,splitA;
    init(one,next()&255u,next()&255u,next()&127u,next()%3u,next()&1u,next()&15u);
    splitA=one;
    unsigned first=next()%50000u,second=next()%50000u;
    forja65AdvanceSpcTimers(one,first+second);
    forja65AdvanceSpcTimers(splitA,first);
    forja65AdvanceSpcTimers(splitA,second);
    same(one,splitA);++split;
  }
  std::cout<<"SPC_TIMER_FAST_FORWARD_V043682_PASS exhaustive="<<65536
           <<" bounded="<<bounded<<" split="<<split
           <<" massive="<<massive<<" total="<<(bounded+split+massive)
           <<" prescalers=16/128 target_zero=256 changed_target=covered\n";
}
