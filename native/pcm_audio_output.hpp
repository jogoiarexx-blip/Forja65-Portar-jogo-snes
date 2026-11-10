#pragma once
// Host PCM transport only. Does not read or mutate SNES CPU/APU/DSP state.
// 16-bit interleaved stereo, 32000 Hz; no additional dependencies on Windows.
#include <array>
#include <algorithm>
#include <cstdint>
#include <limits>
#include <fstream>
#include <string>
#include <cstdlib>
#include <utility>
#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <mmsystem.h>
#endif

class PcmAudioOutput {
public:
  static constexpr unsigned rate=32000,channels=2,blockFrames=512,blocks=12;
  std::uint64_t framesGenerated{},framesNonzero{},framesQueued{},framesDropped{},waveFrames{},gainClippedFrames{};
  std::uint64_t bufferWaitMs{},drainWaitMs{};
  unsigned peak{};
  bool liveRequested{},liveReady{},liveEverOpened{},wavRequested{},wavReady{},wavEverOpened{};
  unsigned gainPercent{100};
  // Host-only output rate. The SNES DSP and .wav dump always stay 32 kHz.
  unsigned deviceRate{rate};
  // An audio clock should pace playback instead of silently discarding blocks
  // when a native port temporarily runs faster than real time.
  bool syncLive{true},drainLive{true};
  // REV144: com audio ao vivo, o DAC comanda o ritmo do jogo (fila curta).
  bool audioPacing{true};unsigned maxQueued{4};
  bool pacesHost()const{return liveReady&&syncLive&&audioPacing;}
  std::string deviceError;
  PcmAudioOutput()=default;
  PcmAudioOutput(const PcmAudioOutput&)=delete;
  PcmAudioOutput& operator=(const PcmAudioOutput&)=delete;
  ~PcmAudioOutput(){finish();}

  void start(bool live,bool saveWav,const std::string&path="forja65-native-audio.wav"){
    finish();framesGenerated=framesNonzero=framesQueued=framesDropped=waveFrames=gainClippedFrames=0;
    bufferWaitMs=drainWaitMs=0;pendingFrames=hostPendingFrames=0;
    inputFrameIndex=nextOutputTick=0;lastLeft=lastRight=0;haveLastSample=false;
    peak=0;deviceError.clear();liveRequested=live;wavRequested=saveWav;
    liveEverOpened=wavEverOpened=false;
    if(const char*v=std::getenv("FORJA65_AUDIO_GAIN")){
      char*end=nullptr;const long n=std::strtol(v,&end,10);
      gainPercent=(end&&*end=='\0'&&n>=0&&n<=400)?unsigned(n):100u;
    }else gainPercent=100u;
    audioPacing=!(std::getenv("FORJA65_AUDIO_PACING")&&std::string(std::getenv("FORJA65_AUDIO_PACING"))=="0");
    if(const char*q=std::getenv("FORJA65_AUDIO_LATENCY_BLOCKS")){const long n=std::strtol(q,nullptr,10);maxQueued=(n>=2&&n<=12)?unsigned(n):4u;}else maxQueued=4u;
    deviceRate=std::getenv("FORJA65_AUDIO_DEVICE_RATE")&&
      std::string(std::getenv("FORJA65_AUDIO_DEVICE_RATE"))=="48000"?48000u:rate;
    // Only affect WinMM transport. PCM samples, DSP clock and WAV stay unchanged.
    syncLive=!(std::getenv("FORJA65_AUDIO_SYNC")&&std::string(std::getenv("FORJA65_AUDIO_SYNC"))=="0");
    drainLive=!(std::getenv("FORJA65_AUDIO_DRAIN")&&std::string(std::getenv("FORJA65_AUDIO_DRAIN"))=="0");
    if(saveWav){wav.open(path,std::ios::binary|std::ios::trunc);if(wav){writeWavHeader(0);wavReady=bool(wav);wavEverOpened=wavReady;}else deviceError="Nao foi possivel abrir o arquivo WAV";}
#ifdef _WIN32
    if(live){
      WAVEFORMATEX fmt{};fmt.wFormatTag=WAVE_FORMAT_PCM;fmt.nChannels=channels;
      fmt.nSamplesPerSec=deviceRate;fmt.wBitsPerSample=16;fmt.nBlockAlign=4;
      fmt.nAvgBytesPerSec=deviceRate*4;
      MMRESULT result=waveOutOpen(&device,WAVE_MAPPER,&fmt,0,0,CALLBACK_NULL);
      // REV195: alguns drivers recusam 32 kHz; tenta 48 kHz (reamostrador 2:3 existente) antes de ficar mudo.
      if(result!=MMSYSERR_NOERROR&&deviceRate==rate){deviceError="waveOutOpen 32000 Hz falhou ("+std::to_string(result)+"); usando 48000 Hz";deviceRate=48000u;fmt.nSamplesPerSec=deviceRate;fmt.nAvgBytesPerSec=deviceRate*4;device=nullptr;result=waveOutOpen(&device,WAVE_MAPPER,&fmt,0,0,CALLBACK_NULL);}
      if(result==MMSYSERR_NOERROR){
        liveReady=true;if(!timerRaised){timeBeginPeriod(1);timerRaised=true;} // REV144: Sleep(1) de 1 ms
        for(auto&b:buffers){
          b.hdr.lpData=reinterpret_cast<LPSTR>(b.samples.data());
          b.hdr.dwBufferLength=sizeof(b.samples);
          const MMRESULT prep=waveOutPrepareHeader(device,&b.hdr,sizeof(b.hdr));
          if(prep!=MMSYSERR_NOERROR){deviceError="waveOutPrepareHeader falhou ("+std::to_string(prep)+")";liveReady=false;break;}
          b.prepared=true;
        }
        if(!liveReady)closeDevice();else liveEverOpened=true;
      }else{deviceError+=(deviceError.empty()?"":"; ")+std::string("waveOutOpen falhou (")+std::to_string(result)+")";device=nullptr;}
    }
#else
    if(live)deviceError="Reproducao em tempo real implementada somente no Windows";
#endif
  }
  void push(std::int16_t left,std::int16_t right){
    const int scaledL=int(left)*int(gainPercent)/100;
    const int scaledR=int(right)*int(gainPercent)/100;
    if(scaledL>32767||scaledL<-32768||scaledR>32767||scaledR<-32768)++gainClippedFrames;
    left=(std::int16_t)std::clamp(scaledL,-32768,32767);
    right=(std::int16_t)std::clamp(scaledR,-32768,32767);
    ++framesGenerated;
    const auto abs16=[](std::int16_t x){return x==-32768?32768u:unsigned(x<0?-int(x):int(x));};
    peak=std::max({peak,abs16(left),abs16(right)});
    if(left||right)++framesNonzero;
    // Windows 48 kHz output is optional. Streaming 3:2 interpolation never
    // touches DSP state or the unmodified 32 kHz PCM/WAV recording.
    if(liveReady && deviceRate==48000)resampleToHost(left,right);
    // Keep the WAV buffer separate from the 48-kHz live queue.
    if(wavReady || (liveReady && deviceRate==rate)){
      pending[pendingFrames*2]=left;pending[pendingFrames*2+1]=right;
      ++pendingFrames;
      if(pendingFrames==blockFrames)flush(false);
    }
  }
  void finish(){
    if(pendingFrames)flush(true);
#ifdef _WIN32
    if(liveReady && deviceRate==48000 && hostPendingFrames){
      submitDevice(hostPending.data(),hostPendingFrames,true);
      hostPendingFrames=0;
    }
    drainDevice();
    closeDevice();
#endif
    if(wav.is_open()){
      wav.seekp(0,std::ios::beg);writeWavHeader(waveFrames*4);
      wav.close();
    }
    liveReady=wavReady=false;pendingFrames=0;
  }
private:
  std::array<std::int16_t,blockFrames*channels> pending{};
  unsigned pendingFrames{};
  std::array<std::int16_t,blockFrames*channels> hostPending{};
  unsigned hostPendingFrames{};
  std::uint64_t inputFrameIndex{},nextOutputTick{};
  std::int16_t lastLeft{},lastRight{};
  bool haveLastSample{};
  std::ofstream wav;
  static constexpr std::uint64_t maxWavFrames=(std::uint64_t(std::numeric_limits<std::uint32_t>::max())-36u)/4u;
#ifdef _WIN32
  HWAVEOUT device{};
  struct Buffer {std::array<std::int16_t,blockFrames*channels> samples{};WAVEHDR hdr{};bool prepared{},submitted{};};
  std::array<Buffer,blocks> buffers{};
  unsigned nextSlot{};
  bool timerRaised{};
  unsigned queuedBlocks()const{unsigned n=0;for(const auto&b:buffers)if(b.submitted&&!(b.hdr.dwFlags&WHDR_DONE))++n;return n;}
  // waveOutReset() cancels sound still playing. Drain a bounded period on
  // graceful exit to preserve the tail of the music (max queued ~= 192 ms).
  void drainDevice(){
    if(!device||!liveReady||!drainLive)return;
    for(unsigned ms=0;ms<350;ms++){
      bool busy=false;
      for(const auto&b:buffers)
        if(b.submitted && !(b.hdr.dwFlags&WHDR_DONE)){busy=true;break;}
      if(!busy)return;
      Sleep(1);++drainWaitMs;
    }
    deviceError+=(deviceError.empty()?"":"; ")+std::string("Timeout aguardando o fim do PCM");
  }
  void closeDevice(){
    if(!device)return;
    waveOutReset(device);
    for(auto&b:buffers){if(b.prepared)waveOutUnprepareHeader(device,&b.hdr,sizeof(b.hdr));b.prepared=b.submitted=false;b.hdr.dwFlags=0;}
    waveOutClose(device);device=nullptr;nextSlot=0;
    if(timerRaised){timeEndPeriod(1);timerRaised=false;}
  }
#endif
  // Rational 32:48 (2:3 sample interval) streaming interpolator. Output
  // sample k lies at input time k*2/3. No boundary discontinuity between
  // 512-frame blocks: previous sample and the phase survive flushes.
  void resampleToHost(std::int16_t left,std::int16_t right){
#ifdef _WIN32
    const std::uint64_t tick=inputFrameIndex++*3u;
    if(!haveLastSample){
      emitHost(left,right);nextOutputTick=2;haveLastSample=true;
    }else{
      const std::uint64_t begin=tick-3u;
      while(nextOutputTick<=tick){
        const int t=int(nextOutputTick-begin);
        const int l=(int(lastLeft)*(3-t)+int(left)*t)/3;
        const int r=(int(lastRight)*(3-t)+int(right)*t)/3;
        emitHost((std::int16_t)l,(std::int16_t)r);
        nextOutputTick+=2;
      }
    }
    lastLeft=left;lastRight=right;
#else
    (void)left;(void)right;
#endif
  }
#ifdef _WIN32
  void emitHost(std::int16_t left,std::int16_t right){
    hostPending[hostPendingFrames*2]=left;
    hostPending[hostPendingFrames*2+1]=right;
    if(++hostPendingFrames==blockFrames){
      submitDevice(hostPending.data(),blockFrames,false);
      hostPendingFrames=0;
    }
  }
  void submitDevice(const std::int16_t*samples,unsigned valid,bool partial){
    if(!liveReady || !valid)return;
      // Fixed-size bounded WinMM queue. By default, pace a full queue;
      // explicit asynchronous mode drops blocks instead.
      Buffer*chosen=nullptr;
      auto findFreeBuffer=[&]()->Buffer*{
        for(unsigned n=0;n<blocks;n++){
          auto&b=buffers[(nextSlot+n)%blocks];
          if(!b.submitted||(b.hdr.dwFlags&WHDR_DONE)){
            nextSlot=(nextSlot+n+1)%blocks;return &b;
          }
        }
        return nullptr;
      };
      // REV144: mantem no maximo maxQueued blocos na fila (latencia ~64 ms); o DAC dita o ritmo.
      if(syncLive&&audioPacing){for(unsigned waited=0;waited<300&&queuedBlocks()>=maxQueued;waited++){Sleep(1);++bufferWaitMs;}}
      chosen=findFreeBuffer();
      // A fast CPU/uncapped replay may produce audio faster than the DAC.
      // Rather than drop a 16 ms chunk, let the host device supply backpressure.
      // This is bounded, and can be disabled for maximum-throughput profiling.
      if(!chosen&&syncLive){
        for(unsigned waited=0;waited<300&&!chosen;waited++){
          Sleep(1);++bufferWaitMs;
          chosen=findFreeBuffer();
        }
      }
      if(chosen){
        std::copy_n(samples,valid*channels,chosen->samples.begin());
        // Padding is only necessary on shutdown; normal writes are full.
        std::fill(chosen->samples.begin()+valid*channels,chosen->samples.end(),0);
        chosen->hdr.dwBufferLength=partial?valid*4u:blockFrames*4u;
        if(waveOutWrite(device,&chosen->hdr,sizeof(chosen->hdr))==MMSYSERR_NOERROR){
          chosen->submitted=true;framesQueued+=valid;
        }else{framesDropped+=valid;deviceError+=(deviceError.empty()?"":"; ")+std::string("waveOutWrite falhou");}
      }else framesDropped+=valid;
      }
#endif
  void flush(bool partial){
    if(!pendingFrames)return;
    const unsigned valid=pendingFrames;
    if(wavReady){
      // Classic RIFF/WAV has a 32-bit length field; never emit an invalid
      // header for a >4 GiB recording. Encode little-endian explicitly.
      const unsigned count=(unsigned)std::min<std::uint64_t>(valid,maxWavFrames-waveFrames);
      std::array<char,blockFrames*channels*2> bytes{};
      for(unsigned i=0;i<count*channels;i++){
        const auto sample=(std::uint16_t)pending[i];
        bytes[i*2]=char(sample&255u);bytes[i*2+1]=char(sample>>8);
      }
      if(count)wav.write(bytes.data(),std::streamsize(count*channels*2u));
      if(wav)waveFrames+=count;
      else {wavReady=false;deviceError+=(deviceError.empty()?"":"; ")+std::string("Erro gravando WAV");}
      if(count<valid){wavReady=false;deviceError+=(deviceError.empty()?"":"; ")+std::string("WAV atingiu o limite RIFF de 4 GiB");}
    }
#ifdef _WIN32
    if(liveReady && deviceRate==rate)submitDevice(pending.data(),valid,partial);
#else
    (void)partial;
#endif
    pendingFrames=0;
  }
  void writeWavHeader(std::uint64_t dataBytes){
    const std::uint32_t size=std::uint32_t(std::min<std::uint64_t>(dataBytes,maxWavFrames*4u));
    auto u16=[this](unsigned v){char b[2]={char(v&255),char((v>>8)&255)};wav.write(b,2);};
    auto u32=[this](std::uint32_t v){char b[4]={char(v&255),char((v>>8)&255),char((v>>16)&255),char((v>>24)&255)};wav.write(b,4);};
    wav.write("RIFF",4);u32(36+size);wav.write("WAVEfmt ",8);u32(16);u16(1);u16(channels);u32(rate);u32(rate*4);u16(4);u16(16);wav.write("data",4);u32(size);
  }
};
