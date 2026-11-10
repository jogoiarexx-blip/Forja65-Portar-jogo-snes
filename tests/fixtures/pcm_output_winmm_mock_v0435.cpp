#include "pcm_audio_output.hpp"
#include <cassert>
#include <iostream>
// The fake device keeps every queued buffer busy until Sleep is called,
// permitting deterministic tests of backpressure and drain without Windows.
int main(){
  PcmAudioOutput x;
  x.start(true,false);
  assert(x.liveReady && x.liveEverOpened && x.syncLive);
  for(int i=0;i<13*512;i++)x.push(1,-1);
  assert(x.framesGenerated==13*512 && x.framesQueued==13*512);
  assert(x.framesDropped==0 && x.bufferWaitMs>0);
  x.finish();
  assert(x.drainWaitMs>0 && x.framesDropped==0);
  PcmAudioOutput y;
  y.start(true,false);
  assert(y.liveReady);
  y.syncLive=false;y.drainLive=false;
  for(int i=0;i<13*512;i++)y.push(1,1);
  assert(y.framesDropped==512 && y.framesQueued==12*512);
  y.finish();
  std::cout<<"PCM_WINMM_MOCK_V0435_PASS queue_wait=yes drained=yes legacy_drop=512\n";
}
