#include "pcm_audio_output.hpp"
#include <cassert>
#include <cstdlib>
#include <fstream>
#include <filesystem>
#include <iterator>
#include <iostream>
#include <vector>
static void setenv48(){
#if defined(_WIN32) && !defined(__linux__)
  _putenv_s("FORJA65_AUDIO_DEVICE_RATE","48000");
#else
  setenv("FORJA65_AUDIO_DEVICE_RATE","48000",1);
#endif
}
int main(){
  setenv48();
  PcmAudioOutput a;
  a.start(true,true,"forja-test-48k.wav");
  assert(a.liveReady&&a.wavReady&&a.deviceRate==48000);
  assert(mockOutputRate==48000); // Opened the DAC at 48 kHz
  for(int i=0;i<512;i++)a.push((std::int16_t)(300*i),(std::int16_t)(-300*i));
  assert(a.framesGenerated==512&&a.waveFrames==512);
  assert(a.framesQueued==512); // One full WinMM buffer of resampled output
  assert(mockCount==1);
  const auto*pcm=reinterpret_cast<const std::int16_t*>(mockHeaders[0]->lpData);
  assert(pcm[0]==0 && pcm[1]==0);
  assert(pcm[2]==200 && pcm[3]==-200);
  assert(pcm[4]==400 && pcm[5]==-400);
  assert(pcm[6]==600 && pcm[7]==-600);
  a.finish();
  assert(a.framesQueued==767); // 512 source frames, 767 output frames
  assert(a.framesDropped==0);
  std::ifstream f("forja-test-48k.wav",std::ios::binary);
  assert(f);
  std::vector<unsigned char>b((std::istreambuf_iterator<char>(f)),{});
  assert(b.size()==44u+512u*4u);
  const auto u32=[&](int k){return unsigned(b[k])|(unsigned(b[k+1])<<8)|(unsigned(b[k+2])<<16)|(unsigned(b[k+3])<<24);};
  assert(u32(24)==32000); // WAV still exports unmodified 32 kHz DSP audio
  assert(u32(40)==512*4u);
  f.close();std::filesystem::remove("forja-test-48k.wav");
  std::cout<<"PCM_48KHZ_WINMM_STREAMING_V0435_PASS rate=48000 wav=32000 resampled=767\n";
}
