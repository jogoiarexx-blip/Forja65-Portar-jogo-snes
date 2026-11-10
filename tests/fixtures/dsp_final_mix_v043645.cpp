#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <array>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <random>
#include <vector>

static int floor7(int x){return x>=0? x/128 : -int((std::int64_t(-x)+127)/128);}
static int wrap16(int x){unsigned u=unsigned(x)&65535u; return u<32768u?int(u):int(u)-65536;}
static int clip(int x){return x<-32768?-32768:x>32767?32767:x;}
static int oracle(int dry,int wet,int mv,int ev){
  return clip(wrap16(floor7(dry*mv))+wrap16(floor7(wet*ev)));
}
static void check(int dry,int wet,int mv,int ev,unsigned &cases){
  int got=SpcDsp::finalMixHardware(dry,wet,mv,ev);
  int exp=oracle(dry,wet,mv,ev);
  if(got!=exp){std::cerr<<"mix mismatch dry="<<dry<<" wet="<<wet<<" mv="<<mv<<" ev="<<ev<<" got="<<got<<" expected="<<exp<<"\n";std::abort();}
  ++cases;
}
static SpcDsp setup(bool hardware){
  SpcDsp d;
  d.hardwareVolumeScaling=hardware;
  d.hardwareKeyTiming=false;
  d.hardwareEnvelopeTiming=false;
  d.hardwareEchoFir=true;
  d.echoRamWritesAllowed=false;
  d.interpolation=SpcDsp::Interpolation::Linear;
  d.regs[0x0c]=0xff;d.regs[0x1c]=0x01;
  d.regs[0x2c]=0xff;d.regs[0x3c]=0x01;
  d.regs[0x7d]=1;d.regs[0x6d]=0x80;d.regs[0x7f]=64;
  d.echoConfigured=true;
  // One valid voice, tiny negative output and asymmetrical L/R panning.
  auto &v=d.voice[0];v.active=true;v.blockPos=0;v.phase=0;
  v.decoded[0]=v.decoded[1]=256;
  d.regs[0x00]=1;d.regs[0x01]=std::uint8_t(-1);
  d.regs[0x07]=127;
  return d;
}
int main(){
  unsigned cases=0;
  for(int dry:{-32768,-32767,-30000,-129,-128,-127,-3,-1,0,1,3,127,128,129,30000,32766,32767})
    for(int wet:{-32768,-32767,-123,-1,0,1,123,32766,32767})
      for(int mv:{-128,-127,-1,0,1,64,127})
        for(int ev:{-128,-127,-1,0,1,64,127})check(dry,wet,mv,ev,cases);
  std::mt19937 gen(0x650645);
  for(int n=0;n<60000;n++){
    check(int(gen()%65536)-32768,int(gen()%65536)-32768,int(gen()%256)-128,int(gen()%256)-128,cases);
  }
  // Real renderSamples: echo read path, signed master/echo volume and FLG mute.
  unsigned rendered=0;
  for(bool hardware:{false,true})for(int echoL:{-32000,-1,0,1,32000})for(int echoR:{-32000,1,32000}){
    auto d=setup(hardware);std::vector<std::uint8_t>ram(65536,0);
    d.writeReg(0x6c,0,ram); // hardware defaults to internally muted until FLG is written
    unsigned a=0x8000;
    std::uint16_t u=std::uint16_t(echoL);ram[a]=std::uint8_t(u);ram[a+1]=std::uint8_t(u>>8);
    u=std::uint16_t(echoR);ram[a+2]=std::uint8_t(u);ram[a+3]=std::uint8_t(u>>8);
    auto observed=d.renderSample(ram);
    // First echo FIR history sample is the newest; FIR7 = 64 means gain one
    // on the (signed input >> 1) copy. Independently verify final volumes.
    int sample=hardware?((256*2032/2048)&~1):256*2032/2047;
    int dryL=hardware?floor7(sample*(int)(std::int8_t)d.regs[0]):sample*(int)(std::int8_t)d.regs[0]/127;
    int dryR=hardware?floor7(sample*(int)(std::int8_t)d.regs[1]):sample*(int)(std::int8_t)d.regs[1]/127;
    auto wetScale=[](int e){int half=e>=0?e/2:-int((std::int64_t(-e)+1)/2);return half&~1;};
    int wetL=wetScale(echoL),wetR=wetScale(echoR);
    int wantL=hardware?oracle(dryL,wetL,-1,-1):clip(dryL*-1/127+wetL*-1/127);
    int wantR=hardware?oracle(dryR,wetR,1,1):clip(dryR*1/127+wetR*1/127);
    if(int(observed[0])!=wantL||int(observed[1])!=wantR){
      std::cerr<<"render mismatch hardware="<<hardware<<" echo="<<echoL<<","<<echoR<<" output="<<observed[0]<<","<<observed[1]<<" want="<<wantL<<","<<wantR<<"\n";
      return 1;
    }
    // Mute must win after both channels have been calculated.
    d.regs[0x6c]=0x40;
    auto muted=d.renderSample(ram);
    assert(muted[0]==0&&muted[1]==0);
    rendered+=2;
  }
  // Render in chunks versus one contiguous render: no discontinuity introduced.
  for(bool hardware:{false,true}){
    std::vector<std::uint8_t>ramA(65536,0),ramB(65536,0);
    auto a=setup(hardware),b=setup(hardware);
    a.writeReg(0x6c,0,ramA);b.writeReg(0x6c,0,ramB);
    auto one=a.render(ramA,64);
    auto part1=b.render(ramB,9),part2=b.render(ramB,55);
    part1.insert(part1.end(),part2.begin(),part2.end());
    assert(one==part1);
  }
  std::cout<<"DSP_FINAL_MIX_V043645_PASS cases="<<cases<<" render_checks="<<rendered<<" chunk_continuity=2 legacy_preserved=1\n";
}
