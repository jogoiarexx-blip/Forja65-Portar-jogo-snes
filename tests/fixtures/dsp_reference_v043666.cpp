#include "runtime.hpp"
#include <iostream>
#include <vector>
#include <cstdint>
#include <cstdlib>
// Independent arithmetic oracle for ares voice3c/voiceOutput, pinned at
// 9408cb43d4948fc3ea6e152a307a34348df3fe04. Uses mathematical floor
// division rather than the implementation's shift helpers.
static int floorDiv(int n,int d){int q=n/d;return q-((n<0&&n%d)!=0);}
static int envOracle(int raw,int env){int q=floorDiv(raw*env,2048);return q-(q%2!=0);}
static int clip(int n){return n<-32768?-32768:n>32767?32767:n;}
static int wrap16(int n){unsigned q=unsigned(n)&65535u;return q>=32768u?int(q)-65536:int(q);}
static int master(int n,int vol){return wrap16(floorDiv(n*vol,128));}
static SpcDsp setup(int raw,unsigned gain,bool hardware){
 SpcDsp d;d.hardwareVolumeScaling=hardware;d.hardwareEnvelopeTiming=true;
 d.hardwareKeyTiming=false;d.hardwareEchoFir=false;d.echoRamWritesAllowed=true;
 d.interpolation=SpcDsp::Interpolation::Linear;
 auto &v=d.voice[0];v.active=true;v.blockPos=0;v.phase=0;
 v.decoded[0]=v.decoded[1]=std::int16_t(raw);d.regs[7]=gain;
 d.regs[0x0c]=d.regs[0x1c]=127;return d;
}
int main(){
 unsigned cases=0,mismatch=0;std::vector<std::uint8_t> ram(65536,0);
 auto check=[&](int got,int expected,const char*stage){
   if(got!=expected){if(mismatch<5)std::cerr<<stage<<" case="<<cases<<" got="<<got<<" expected="<<expected<<"\n";++mismatch;}
   ++cases;
 };
 // Every direct GAIN value; signs, rounding boundaries and full scale.
 for(unsigned gain=0;gain<128;gain++)for(int raw:{-32768,-32766,-30000,-2050,-2048,-258,-256,-130,-128,-2,0,2,126,128,254,256,2046,2048,30000,32766}){
   auto d=setup(raw,gain,true);int want=envOracle(raw,int(gain)*16);
   check(d.nextSample(0,ram),want,"envelope");
   check(int(std::int8_t(d.regs[9])),floorDiv(want,256),"OUTX");
   auto legacy=setup(raw,gain,false);
   check(legacy.nextSample(0,ram),raw*int(gain)*16/2047,"legacy-envelope");
 }
 // Noise follows the same output quantization path (NON substitutes before ENV).
 for(unsigned gain:{1u,31u,63u,127u})for(unsigned noise:{1u,0x1234u,0x4000u,0x7fffu}){
   auto d=setup(0,gain,true);d.regs[0x3d]=1;d.noiseLfsr=noise;
   const int raw=noise>=0x4000u?int(noise*2)-65536:int(noise*2);
   check(d.nextSample(0,ram),envOracle(raw,int(gain)*16),"noise-envelope");
 }
 // Exercise the actual dry and echo voice paths, both signed L/R panning,
 // and final MVOL. Echo feedback and FIR are deliberately disabled here.
 for(int raw:{-32768,-2050,-256,-2,2,128,256,2050,30000,32766})for(unsigned gain:{1u,63u,127u})for(int volume=-128;volume<=127;volume++){
   auto d=setup(raw,gain,true);d.regs[0]=std::uint8_t(volume);d.regs[1]=std::uint8_t(-1);
   d.regs[0x4d]=1;d.regs[0x6d]=0x80;d.regs[0x7d]=1;d.echoConfigured=true;
   const int sample=envOracle(raw,int(gain)*16);
   const int left=floorDiv(sample*volume,128),right=floorDiv(-sample,128);
   const auto got=d.renderSample(ram);
   check(got[0],clip(master(left,127)),"dry-left");
   check(got[1],clip(master(right,127)),"dry-right");
   check(SpcDsp::readSigned16(ram,0x8000),left,"echo-left");
   check(SpcDsp::readSigned16(ram,0x8002),right,"echo-right");
 }
 // PMON must consume the quantized prior voice output before panning.
 for(int raw:{-32768,-2050,-2,2,2050,32766}){
   auto d=setup(raw,127,true);d.voice[1]=d.voice[0];d.regs[0x17]=127;
   d.regs[0x12]=0x34;d.regs[0x13]=0x12;d.regs[0x2d]=2;
   int output=d.nextSample(0,ram);d.nextSample(1,ram,output);
   int pitch=0x1234+floorDiv(0x1234*floorDiv(envOracle(raw,2032),32),1024);
   check(int(d.voice[1].phase),pitch%4096,"PMON");
 }
 std::cout<<"DSP_REFERENCE_V043666 cases="<<cases<<" mismatches="<<mismatch<<"\n";
 return mismatch?1:0;
}
