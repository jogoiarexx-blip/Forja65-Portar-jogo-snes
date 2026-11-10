#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>
#include <array>
#include <random>

static int clamp(int v){return v<-32768?-32768:v>32767?32767:v;}
static int read16(std::vector<std::uint8_t>&r,unsigned addr){
 unsigned u=unsigned(r[addr])|(unsigned(r[addr+1])<<8);
 return u>=32768?int(u)-65536:int(u);
}
struct Oracle {int left, right, echoLeft, echoRight;};
static Oracle expected(const std::array<int,8>&raw,
    const std::array<int,8>&gainL,const std::array<int,8>&gainR,
    std::uint8_t eon,bool hardware){
 int l=0,r=0,el=0,er=0;
 for(unsigned i=0;i<8;i++){
   // Direct GAIN=0x7f sets ENV to 2032 (without ADSR).
   const int product=raw[i]*2032;
   const int floor11=product>=0?product/2048:-int((std::int64_t(-product)+2047)/2048);
   const int sample=hardware?(floor11&~1):product/2047;
   const int divisor=hardware?128:127;
   const auto scale=[&](int volume){int p=sample*volume;
     return hardware?(p>=0?p/128:-int((std::int64_t(-p)+127)/128)):p/divisor;};
   const int vl=scale(gainL[i]),vr=scale(gainR[i]);
   if(hardware){l=clamp(l+vl);r=clamp(r+vr);}else{l+=vl;r+=vr;}
   if(eon&(1u<<i)){
     if(hardware){el=clamp(el+vl);er=clamp(er+vr);}
     else{el+=vl;er+=vr;}
   }
 }
 // This legacy fixture now accounts for the v0.4.36.45 final DAC
 // stage: signed floor shift and 16-bit wrapping of each volume product.
 const auto finalStage=[&](int main){
   if(!hardware)return clamp(main*127/127);
   const int product=main*127;
   const int shifted=product>=0?product/128:-int((std::int64_t(-product)+127)/128);
   const unsigned u=unsigned(shifted)&65535u;
   return clamp(u<32768u?int(u):int(u)-65536);
 };
 return {finalStage(l),finalStage(r),clamp(el),clamp(er)};
}
static void one(const std::array<int,8>&raw,
    const std::array<int,8>&gainL,const std::array<int,8>&gainR,
    std::uint8_t eon,bool hardware,unsigned&cases){
 SpcDsp d;
 d.hardwareVolumeScaling=hardware;
 d.hardwareEnvelopeTiming=false;
 d.hardwareKeyTiming=false;
 d.interpolation=SpcDsp::Interpolation::Linear;
 d.hardwareEchoFir=false;
 d.echoConfigured=true;
 d.echoRamWritesAllowed=true;
 d.regs[0x0c]=127; d.regs[0x1c]=127;
 d.regs[0x2c]=0;d.regs[0x3c]=0;
 d.regs[0x4d]=eon;
 d.regs[0x6d]=0x80; // Echo write at $8000, far from BRR data.
 d.regs[0x7d]=0;
 d.regs[0x0d]=0; // Feedback disabled for exact comparison.
 std::vector<std::uint8_t>ram(65536,0);
 for(unsigned i=0;i<8;i++){
   auto &v=d.voice[i];v.active=true;
   v.blockPos=0;v.phase=0;v.decoded[0]=std::int16_t(raw[i]);
   v.decoded[1]=std::int16_t(raw[i]);
   d.regs[(i<<4)|0]=std::uint8_t(gainL[i]);
   d.regs[(i<<4)|1]=std::uint8_t(gainR[i]);
   d.regs[(i<<4)|7]=127; // Direct gain, no ADSR / clock dependence.
   d.regs[(i<<4)|2]=0;d.regs[(i<<4)|3]=0;
 }
 const auto observed=d.renderSample(ram);
 const auto want=expected(raw,gainL,gainR,eon,hardware);
 if(int(observed[0])!=want.left ||int(observed[1])!=want.right
    || read16(ram,0x8000)!=want.echoLeft||read16(ram,0x8002)!=want.echoRight){
   std::cerr<<"case="<<cases<<" hardware="<<hardware
     <<" left="<<observed[0]<<" wanted="<<want.left
     <<" right="<<observed[1]<<" wanted="<<want.right
     <<" echoL="<<read16(ram,0x8000)<<" wanted="<<want.echoLeft
     <<" echoR="<<read16(ram,0x8002)<<" wanted="<<want.echoRight<<"\n";
   std::abort();
 }
 ++cases;
}
int main(){
 unsigned cases=0;
 std::array<int,8> raw{30000,30000,-30000,-30000,30000,30000,-30000,-30000};
 std::array<int,8> gL{127,127,127,127,127,127,127,127};
 std::array<int,8> gR{-128,-128,-128,-128,-128,-128,-128,-128};
 for(bool hardware:{false,true})for(unsigned e:{0xffu,0x0fu,0xf0u,0x33u,0u})
   one(raw,gL,gR,std::uint8_t(e),hardware,cases);
 // Fixed-seed deterministic fuzz exercises eight-voice channel ordering,
 // positive and negative clipping, and echo-enabled subsets.
 std::mt19937 rng(0x4a650642u);
 for(unsigned n=0;n<1500;n++){
   for(unsigned i=0;i<8;i++){
     raw[i]=int(rng()%60001u)-30000;
     gL[i]=int(rng()%256u)-128;
     gR[i]=int(rng()%256u)-128;
   }
   const std::uint8_t eon=std::uint8_t(rng()%256u);
   one(raw,gL,gR,eon,true,cases);
   one(raw,gL,gR,eon,false,cases);
 }
 std::cout<<"DSP_VOICE_MIX_SATURATION_V043642_PASS cases="<<cases
          <<" saturated_per_voice=1 echo_per_voice=1 legacy_preserved=1\n";
}
