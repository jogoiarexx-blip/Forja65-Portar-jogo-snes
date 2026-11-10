#include "runtime.hpp"
#include <iostream>
#include <vector>
#include <cstdlib>
#include <random>
static unsigned checks=0,failures=0;
static void check(bool ok,const char*msg){++checks;if(!ok){if(failures<6)std::cerr<<msg<<"\n";++failures;}}
static void wr(ApuBridge &a,unsigned reg,unsigned value){a.spcWrite(0xf2,std::uint8_t(reg));a.spcWrite(0xf3,std::uint8_t(value));}
static unsigned rd(ApuBridge &a,unsigned reg){a.spcWrite(0xf2,std::uint8_t(reg));return a.spcRead(0xf3);}
static void samples(SnesRuntime &h,unsigned count){auto target=h.apu.dspNativeSamples+count;while(h.apu.dspNativeSamples<target)h.apu.tickMasterCycles(1);}
// Independent state transition oracle, evaluated before rate gating.
struct Env {int env,hidden,stage;};
static Env oracle(Env o,bool releasing,unsigned adsr1,unsigned adsr2,unsigned gain,int clock){
 if(releasing){o.env=std::max(0,o.env-8);return o;}
 int proposed=o.env;unsigned rate;unsigned data=adsr2;
 if(adsr1>=128){
  if(o.stage==0){rate=(adsr1%16)*2+1;proposed+=rate==31?1024:32;}
  else{proposed-=1;proposed-=proposed>=0?proposed/256:-int((-proposed+255)/256);rate=o.stage==1?16+2*((adsr1/16)%8):adsr2%32;}
 }else{
  data=gain;unsigned mode=gain/32;
  if(mode<4){proposed=gain*16;rate=31;}
  else{rate=gain%32;if(mode==4)proposed-=32;else if(mode==5){proposed-=1;proposed-=proposed>=0?proposed/256:-int((-proposed+255)/256);}else proposed+=(mode==7&&unsigned(o.hidden)>=1536)?8:32;}
 }
 if(o.stage==1&&(proposed>=0?proposed/256:-int((-proposed+255)/256))==int(data/32))o.stage=2;
 o.hidden=proposed;
 if(proposed<0||proposed>2047){proposed=std::max(0,std::min(2047,proposed));if(o.stage==0)o.stage=1;}
 // Independently expressed 30720-clock rate table and offsets.
 const unsigned periods[]={0,2048,1536,1280,1024,768,640,512,384,320,256,192,160,128,96,80,64,48,40,32,24,20,16,12,10,8,6,5,4,3,2,1};
 unsigned offset=rate==0?1:rate>=30?0:rate%3==2?1040:rate%3==0?536:0;
 if(rate&&(unsigned(clock)+offset)%periods[rate]==0)o.env=proposed;
 return o;
}
static void envelopeDifferential(){
 std::mt19937 rng(0x650667);SpcDsp d;
 for(unsigned n=0;n<50000;++n){
  auto &v=d.voice[0];v.active=true;v.releasing=(n%17)==0;v.env=rng()%2048;v.hiddenEnv=int(rng()%4096)-32;v.envStage=rng()%3;
  d.regs[5]=rng()%256;d.regs[6]=rng()%256;d.regs[7]=rng()%256;d.envelopeClock=rng()%30720;
  Env expected=oracle({v.env,v.hiddenEnv,v.envStage},v.releasing,d.regs[5],d.regs[6],d.regs[7],d.envelopeClock);
  d.stepEnvelopeHardware(0);
  check(v.env==expected.env,"reference visible envelope");check(v.hiddenEnv==expected.hidden,"reference hidden envelope");check(v.envStage==expected.stage,"reference ADSR/GAIN stage");check(v.active,"reference release retains processing");
 }
}
int main(int argc,char**argv){
 if(argc!=2)return 2;
 envelopeDifferential();
 SpcDsp legacy;legacy.hardwareEnvelopeTiming=false;legacy.voice[0].active=true;legacy.voice[0].releasing=true;legacy.voice[0].env=8;legacy.stepEnvelope(0);check(!legacy.voice[0].active&&legacy.voice[0].env==0,"explicit legacy release preserves stop");
 for(bool loop:{false,true})for(unsigned voice=0;voice<8;++voice)for(unsigned gain:{1u,2u,3u})for(unsigned pitch:{0x800u,0x1000u}){
   // Use the real SnesRuntime audio profile, SPC $F2/$F3 interface and
   // fractional APU clock. SLEEP isolates DSP from a concurrent driver.
   SnesRuntime h(argv[1],MapperKind::LoROM,0,0,0,CartChip::None,"test.srm",1,true);
   auto &a=h.apu;a.spc.sleeping=true;a.enableMemoryPcmCapture(true);
   check(a.nativeDspReady()&&a.dsp.hardwareEnvelopeTiming&&a.dsp.hardwareKeyTiming,"real runtime hardware DSP profile");
   unsigned b=voice<<4,bit=1u<<voice;
   // DIR source0: sample and loop both at $2000. The first END block
   // takes 16 samples at pitch $1000, longer at pitch $0800.
   a.spcWrite(0x1000,0);a.spcWrite(0x1001,0x20);a.spcWrite(0x1002,0);a.spcWrite(0x1003,0x20);
   a.spcWrite(0x2000,loop?3:1);for(unsigned j=1;j<=8;++j)a.spcWrite(0x2000+j,0x77);
   wr(a,0x6c,0x20);wr(a,0x5d,0x10);wr(a,b+4,0);wr(a,b+5,0);wr(a,b+7,gain);
   wr(a,b+2,pitch&255);wr(a,b+3,pitch>>8);wr(a,b,127);wr(a,b+1,127);wr(a,0x0c,127);wr(a,0x1c,127);wr(a,0x4c,bit);
   samples(h,8);check(a.dsp.voice[voice].env==(loop?int(gain*16):0),"END without LOOP silences GAIN; END+LOOP establishes GAIN");
   wr(a,0x5c,bit);samples(h,gain*2+2);
   check(a.dsp.voice[voice].env==0,"KOFF releases to zero");
   check(a.dsp.voice[voice].active,"zero release must retain BRR processing before END");
   std::size_t silentFrom=a.nativePcm.size();samples(h,100);
   check((rd(a,0x7c)&bit)!=0,"ENDX must become observable after zero release");
   check(rd(a,b+8)==0&&rd(a,b+9)==0,"released ENVX/OUTX stay zero");
   bool silence=true;for(std::size_t i=silentFrom;i<a.nativePcm.size();++i)if(a.nativePcm[i])silence=false;
   check(silence,"ongoing BRR progression remains silent");
   check(a.dsp.voice[voice].active,"every END keeps silent BRR processing active");
   // KON is allowed to restart the released voice and clears ENDX.
   wr(a,0x5c,0);wr(a,0x4c,bit);samples(h,8);
   check(a.dsp.voice[voice].active&&a.dsp.voice[voice].env==(loop?int(gain*16):0),"KON re-reads END header; only LOOP permits envelope");
   check((rd(a,0x7c)&bit)==0,"KON clears ENDX");
 }
 // GAIN saturation changes the retained ADSR state even with ADSR disabled.
 // On switching back, Decay must run immediately rather than another attack.
 for(unsigned voice=0;voice<8;++voice)for(unsigned mode:{0xdfu,0xffu}){
   SnesRuntime h(argv[1],MapperKind::LoROM,0,0,0,CartChip::None,"test.srm",1,true);auto &a=h.apu;a.spc.sleeping=true;
   unsigned b=voice<<4;a.spcWrite(0x1000,0);a.spcWrite(0x1001,0x20);a.spcWrite(0x1002,0);a.spcWrite(0x1003,0x20);a.spcWrite(0x2000,3);
   wr(a,0x6c,0x20);wr(a,0x5d,0x10);wr(a,b+7,127);wr(a,0x4c,1u<<voice);samples(h,8);
   wr(a,b+7,mode);samples(h,3);
   check(a.dsp.voice[voice].env==2047,"GAIN clips at maximum");check(a.dsp.voice[voice].envStage==1,"GAIN clipping updates retained ADSR stage");
   wr(a,b+5,0xff);wr(a,b+6,0);samples(h,3);
   // Inspect retained stage rather than inventing a DSP pipeline timestamp.
   check(a.dsp.voice[voice].envStage==1,"ADSR switch begins in retained Decay");
   check(rd(a,b+8)==126,"GAIN to ADSR switch exposes correct ENVX decay");
 }
 std::cout<<"DSP_RELEASE_ENDX_V043667 cases="<<checks<<" failures="<<failures<<"\n";return failures?1:0;
}
