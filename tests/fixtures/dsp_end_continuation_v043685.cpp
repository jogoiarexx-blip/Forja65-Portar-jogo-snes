#include "runtime.hpp"
#include <iostream>
#include <vector>
static unsigned checks=0,failures=0;
static void check(bool ok,const char*msg){++checks;if(!ok){if(failures<10)std::cerr<<msg<<"\n";++failures;}}
static void wr(ApuBridge&a,unsigned r,unsigned v){a.spcWrite(0xf2,r);a.spcWrite(0xf3,v);}
static unsigned rd(ApuBridge&a,unsigned r){a.spcWrite(0xf2,r);return a.spcRead(0xf3);}
static void samples(SnesRuntime&h,unsigned n){auto target=h.apu.dspNativeSamples+n;while(h.apu.dspNativeSamples<target)h.apu.tickMasterCycles(1);}
static void pointer(std::vector<std::uint8_t>&r,unsigned at,unsigned value){r[at&65535]=value&255;r[(at+1)&65535]=value>>8;}
int main(int argc,char**argv){
 if(argc!=2)return 2;
 for(unsigned i=0;i<8;++i)for(unsigned pitch:{0u,0x800u,0x1000u,0x3fffu})for(bool keyTiming:{false,true}){
  SpcDsp d;d.hardwareEnvelopeOutput=true;d.hardwareKeyTiming=keyTiming;
  std::vector<std::uint8_t> ram(65536);unsigned b=i<<4,bit=1u<<i;
  pointer(ram,0x1000,0x2000);pointer(ram,0x1002,0x3000);
  ram[0x2000]=0x91;ram[0x3000]=0x93;for(unsigned n=1;n<=8;++n)ram[0x2000+n]=ram[0x3000+n]=0x77;
  d.regs[0x5d]=0x10;d.regs[b|7]=127;d.regs[b|2]=pitch&255;d.regs[b|3]=pitch>>8;
  d.keyOn(i,ram);for(unsigned n=0;n<5;++n)d.renderSample(ram);
  int first=d.nextSample(i,ram);
  check(first==0&&d.voice[i].env==0,"first END-without-LOOP block must not establish a GAIN envelope");
  check(d.voice[i].releasing&&d.voice[i].active,"END header sets release without disabling BRR processing");
  for(unsigned n=0;n<150;++n)d.renderSample(ram);
  check(d.voice[i].active,"END-without-LOOP keeps the oscillator active");
  check(d.voice[i].env==0&&d.regs[b|8]==0&&d.regs[b|9]==0,"GAIN cannot revive an END-silenced voice");
  check(bool(d.regs[0x7c]&bit)==bool(pitch),"ENDX reflects reaching a BRR boundary, not just reading END header");
  if(pitch){
   check(d.voice[i].addr==0x3009,"END-without-LOOP redirects to the directory loop pointer");
   d.writeReg(0x7c,255,ram);check(d.readReg(0x7c)==0,"ENDX write clears pending flags");
   for(unsigned n=0;n<100;++n)d.renderSample(ram);
   check(d.readReg(0x7c)&bit,"continued silent oscillator can raise ENDX again");
  }
 }
 // A normally sounding voice silences when it reaches a later END-only header.
 for(unsigned i=0;i<8;++i){
  SpcDsp d;d.hardwareEnvelopeOutput=true;std::vector<std::uint8_t>r(65536);unsigned b=i<<4;
  pointer(r,0x1000,0x2000);pointer(r,0x1002,0x4000);r[0x2000]=0x90;r[0x2009]=0x91;r[0x4000]=0x93;
  for(unsigned n=1;n<=8;++n)r[0x2000+n]=r[0x2009+n]=r[0x4000+n]=0x77;
  d.regs[0x5d]=0x10;d.regs[b|7]=127;d.regs[b|3]=0x10;d.keyOn(i,r);
  int output=0;for(unsigned n=0;n<15;++n)output=d.nextSample(i,r);
  check(output!=0&&d.voice[i].env==2032&&!d.voice[i].releasing,"ordinary block establishes audible direct GAIN");
  d.nextSample(i,r); // Existing block-granular decoder fetches the next header.
  check(d.voice[i].env==0&&d.voice[i].releasing,"later END-only header clears the established envelope");
  check(d.nextSample(i,r)==0,"next output after END-only header fetch is silent");
  for(unsigned n=0;n<80;++n)check(d.nextSample(i,r)==0,"continued END-only oscillator stays silent");
  check(d.voice[i].active&&d.voice[i].addr==0x4009,"later END-only block redirects silently to loop directory");
 }
 // Live directory and source retargeting applies to END even with LOOP=0.
 for(unsigned i=0;i<8;++i){
  SpcDsp d;std::vector<std::uint8_t>r(65536);unsigned b=i<<4;
  d.regs[0x5d]=0x10;pointer(r,0x1000,0x2000);pointer(r,0x1002,0x3000);
  r[0x2000]=1;r[0x4000]=0;d.regs[b|7]=127;d.regs[b|3]=0x10;d.keyOn(i,r);
  d.nextSample(i,r);check(d.voice[i].env==0,"END header silences before first output even with immediate KON");
  d.regs[0x5d]=0xff;d.regs[b|4]=0x40; // directory entry wraps through $0000
  pointer(r,2,0x4000);
  for(unsigned n=0;n<15;++n)d.nextSample(i,r);
  check(d.voice[i].active&&d.voice[i].addr==0x4009,"silent END re-reads wrapping DIR/SRCN loop destination");
  check(d.voice[i].releasing&&d.voice[i].env==0,"non-END destination cannot cancel release");
  for(unsigned n=0;n<20;++n)d.nextSample(i,r);
  check(d.voice[i].addr>=0x4012,"silent BRR fetch continues sequentially after non-END destination");
  // Explicit legacy profile retains the old stop-on-END behavior.
  SpcDsp old;old.hardwareEnvelopeTiming=false;old.regs[0x5d]=0x10;old.regs[b|3]=0x10;old.regs[b|7]=127;old.keyOn(i,r);
  for(unsigned n=0;n<16;++n)old.nextSample(i,r);
  check(!old.voice[i].active,"legacy envelope mode retains stop-on-END");
 }
 // Exercise real generated runtime, SPC $F2/$F3 and fractional APU scheduler.
 for(unsigned i=0;i<8;++i){
  SnesRuntime h(argv[1],MapperKind::LoROM,0,0,0,CartChip::None,"test.srm",1,true);auto&a=h.apu;a.spc.sleeping=true;
  unsigned b=i<<4,bit=1u<<i;a.enableMemoryPcmCapture(true);
  pointer(a.spc.ram,0x1000,0x2000);pointer(a.spc.ram,0x1002,0x3000);
  a.spcWrite(0x2000,0x91);a.spcWrite(0x3000,0x93);for(unsigned j=1;j<=8;++j){a.spcWrite(0x2000+j,0x77);a.spcWrite(0x3000+j,0x77);}
  wr(a,0x6c,0x20);wr(a,0x5d,0x10);wr(a,b|7,127);wr(a,b|3,0x10);wr(a,b,127);wr(a,b|1,127);wr(a,0x0c,127);wr(a,0x1c,127);wr(a,0x4c,bit);
  samples(h,100);
  check(a.dsp.voice[i].active&&a.dsp.voice[i].addr==0x3009,"runtime END continues at loop destination");
  check(rd(a,0x7c)&bit,"runtime ENDX remains functional after silent END");
  check(rd(a,b|8)==0&&rd(a,b|9)==0,"runtime END silences ENVX/OUTX");
  bool silence=true;for(auto q:a.nativePcm)if(q)silence=false;check(silence,"first END block produces no audible output");
  // A subsequent KON to a normal looping sample restores audible envelope.
  pointer(a.spc.ram,0x1000,0x3000);wr(a,0x4c,bit);samples(h,8);
  check(a.dsp.voice[i].active&&!a.dsp.voice[i].releasing&&a.dsp.voice[i].env==2032,"KON revives the silent voice on a non-END sample");
  check(!(rd(a,0x7c)&bit),"KON clears ENDX after silent continuation");
 }
 std::cout<<"DSP_END_CONTINUATION_V043685 cases="<<checks<<" failures="<<failures<<"\n";return failures?1:0;
}
