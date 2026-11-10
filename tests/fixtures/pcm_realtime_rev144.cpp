#include "pcm_audio_output.hpp"
#include <cassert>
#include <cstdlib>
#include <iostream>
// REV144: com audio ao vivo o DAC comanda o ritmo (fila curta) e o timer do Windows sobe para 1 ms.
int main(){
  {PcmAudioOutput x;x.start(true,false);
   assert(x.liveReady&&x.pacesHost()&&x.maxQueued==4);
   assert(mockTimerPeriods==1);
   for(int i=0;i<5*512;i++){x.push(1,-1);}         // 5 blocos: o 5o espera a fila baixar de 4
   assert(x.bufferWaitMs>0&&x.framesDropped==0);
   x.finish();assert(mockTimerPeriods==0);}
  {setenv("FORJA65_AUDIO_LATENCY_BLOCKS","8",1);PcmAudioOutput x;x.start(true,false);assert(x.maxQueued==8);
   for(int i=0;i<5*512;i++){x.push(1,-1);}
   assert(x.bufferWaitMs==0);x.finish();unsetenv("FORJA65_AUDIO_LATENCY_BLOCKS");}
  {setenv("FORJA65_AUDIO_PACING","0",1);PcmAudioOutput x;x.start(true,false);
   assert(!x.pacesHost());for(int i=0;i<5*512;i++){x.push(1,-1);}
   assert(x.bufferWaitMs==0);x.finish();}
  std::cout<<"PCM_REALTIME_REV144_PASS fila=4 timer=1ms pacing_off=ok\n";
}
