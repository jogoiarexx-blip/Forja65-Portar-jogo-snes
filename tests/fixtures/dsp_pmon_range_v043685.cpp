#include "runtime.hpp"
#include <iostream>
#include <vector>
#include <random>
static unsigned checks=0,failures=0;
static void check(bool ok,const char* msg){++checks;if(!ok){if(failures<6)std::cerr<<msg<<"\n";++failures;}}
static int floorDiv(int x,int y){int q=x/y;return q-(x%y<0);}
int main(){
 std::vector<std::uint8_t> ram(65536);
 std::mt19937 rng(0x650685);
 // Exercise actual generated nextSample, not a copied implementation helper.
 // Low fourteen interpolation bits correspond to the current sample in each
 // four-sample BRR decoding group plus its twelve fractional position bits.
 for(unsigned n=0;n<40000;++n){
  SpcDsp d;unsigned i=n%8;auto &v=d.voice[i];v.active=true;v.blockPos=rng()%16;v.phase=rng()%4096;
  v.addr=0x2000;v.env=1024;d.regs[(i<<4)|7]=64;
  unsigned pitch=(n<256)?0x3fff:rng()%16384;
  int previous=(n<256)?32766:int(rng()%65536)-32768;
  d.regs[(i<<4)|2]=pitch&255;d.regs[(i<<4)|3]=pitch>>8;
  bool pmon=(n%5)!=0;d.regs[0x2d]=pmon?255:0;
  int step=int(pitch);
  if(i&&pmon)step+=floorDiv(floorDiv(previous,32)*int(pitch),1024);
  unsigned start=unsigned(v.blockPos)*4096+v.phase;
  // Reference V4 caps the sum, not the modulated pitch, at 32767.
  unsigned group=start/16384;
  unsigned local=start%16384;
  unsigned end=group*16384+std::min(32767u,local+unsigned(step));
  d.nextSample(i,ram,previous);
  check(v.phase==end%4096,"PMON interpolation fraction must retain full modulated pitch");
  check(v.blockPos==(end/4096)%16,"PMON BRR cursor must use saturated interpolation accumulator");
 }
 // An audible integration vector: voice 0's pre-panning output feeds voice 1.
 SpcDsp d;d.hardwareVolumeScaling=true;d.hardwareEnvelopeOutput=true;d.regs[0x2d]=2;
 for(unsigned i=0;i<2;++i){auto &v=d.voice[i];v.active=true;v.blockPos=0;v.env=2032;v.addr=0x2000;d.regs[(i<<4)|7]=127;for(auto &x:v.decoded)x=32766;}
 d.regs[0x12]=255;d.regs[0x13]=63;
 d.renderSample(ram);
 int prior=SpcDsp::applyEnvelopeHardware(32766,2032);
 unsigned expected=16383+floorDiv(floorDiv(prior,32)*16383,1024);
 check(d.voice[1].blockPos==expected/4096,"renderSample PMON uses unpanned previous voice with full pitch range");
 check(d.voice[1].phase==expected%4096,"renderSample PMON fractional integration");
 std::cout<<"DSP_PMON_RANGE_V043685 cases="<<checks<<" failures="<<failures<<"\n";
 return failures?1:0;
}
