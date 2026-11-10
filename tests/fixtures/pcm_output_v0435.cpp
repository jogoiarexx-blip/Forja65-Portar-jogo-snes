#include "pcm_audio_output.hpp"
#include <cassert>
#include <cstdint>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
#include <vector>
static void envSet(const char*key,const char*val){
#ifdef _WIN32
  _putenv_s(key,val);
#else
  setenv(key,val,1);
#endif
}
static unsigned word(const std::vector<unsigned char>&b,unsigned pos){
  return unsigned(b.at(pos)) | (unsigned(b.at(pos+1))<<8);
}
static unsigned dword(const std::vector<unsigned char>&b,unsigned pos){
  return word(b,pos)|(word(b,pos+2)<<16);
}
static std::vector<unsigned char> readFile(const char*file){
  std::ifstream f(file,std::ios::binary); assert(f);
  return std::vector<unsigned char>(std::istreambuf_iterator<char>(f),{});
}
int main(){
  envSet("FORJA65_AUDIO_GAIN","200");
  PcmAudioOutput wav;
  wav.start(false,true,"v0435.wav");
  assert(wav.wavReady && wav.rate==32000 && wav.channels==2);
  assert(wav.syncLive && wav.drainLive);
  wav.push(20000,-20000); // saturate when gain 200%
  wav.push(-32768,32767);
  for(int n=0;n<511;n++)wav.push((std::int16_t)n,(std::int16_t)-n);
  assert(wav.framesGenerated==513 && wav.waveFrames==512);
  wav.finish();wav.finish();
  assert(wav.waveFrames==513 && wav.framesNonzero==512 && wav.peak==32768 && wav.gainClippedFrames==2);
  const auto b=readFile("v0435.wav");
  assert(b.size()==44+513*4 && dword(b,4)==b.size()-8);
  assert(dword(b,24)==32000 && dword(b,28)==128000 && word(b,22)==2);
  assert(word(b,34)==16 && dword(b,40)==513*4);
  assert(word(b,44)==0x7fff && word(b,46)==0x8000);
  assert(word(b,48)==0x8000 && word(b,50)==0x7fff);
  std::filesystem::remove("v0435.wav");
  // Start/finish must clear prior PCM and counters, including when neither
  // sound sink is available. Diagnostics must still count the DSP samples.
  envSet("FORJA65_AUDIO_GAIN","100");
  wav.start(false,false);
  wav.push(123,-456);
  assert(wav.framesGenerated==1 && wav.framesNonzero==1 && wav.peak==456);
  assert(wav.waveFrames==0);
  wav.finish();
  envSet("FORJA65_AUDIO_SYNC","0");envSet("FORJA65_AUDIO_DRAIN","0");
  wav.start(false,true,"v0435b.wav");
  assert(!wav.syncLive && !wav.drainLive);
  wav.push(1,2);wav.finish();
  assert(readFile("v0435b.wav").size()==48);
  std::filesystem::remove("v0435b.wav");
  std::cout<<"PCM_OUTPUT_V0435_PASS wav=513 gain=200 saturated=2 little_endian=yes stats=yes restart=yes\n";
}
