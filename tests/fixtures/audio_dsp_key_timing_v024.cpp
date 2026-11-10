#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>

static void setup(SpcDsp& d,std::vector<std::uint8_t>&ram,bool loop){
  d.hardwareKeyTiming=true;
  d.interpolation=SpcDsp::Interpolation::Linear;
  ram[0x200]=0x00;ram[0x201]=0x03;ram[0x202]=0x00;ram[0x203]=0x03;
  ram[0x300]=loop?0x43:0x41; // END+LOOP or END BRR
  for(unsigned i=1;i<9;i++)ram[0x300+i]=0x77;
  auto wr=[&](unsigned a,unsigned v){d.writeReg((std::uint8_t)a,(std::uint8_t)v,ram);};
  wr(0x5d,2);wr(0x00,127);wr(0x01,127);
  wr(0x02,0);wr(0x03,0x10);wr(0x04,0);
  wr(0x05,0);wr(0x07,0x7f);wr(0x0c,127);wr(0x1c,127);
}
int main(){
  std::vector<std::uint8_t> ram(65536);
  SpcDsp d;setup(d,ram,true);
  d.renderSample(ram); // poll phase 1; no KON written yet
  d.writeReg(0x4c,1,ram);
  assert(!d.voice[0].active && d.pendingKeyOn==1);
  d.renderSample(ram); // poll phase 1: should NOT start
  assert(!d.voice[0].active && d.pendingKeyOn==1);
  for(unsigned i=0;i<5;i++){
    const auto sample=d.renderSample(ram);
    assert(d.voice[0].active);
    assert(sample[0]==0 && sample[1]==0);
    assert(d.voice[0].keyStartDelay==4-i);
  }
  assert(d.voice[0].blockPos==16); // first BRR fetch is deferred
  const auto first=d.renderSample(ram);
  assert(first[0]!=0 && first[1]!=0);
  assert(d.voice[0].blockPos==1 && d.voice[0].keyStartDelay==0);
  d.writeReg(0x5c,1,ram);
  const int before=d.voice[0].env;
  for(unsigned n=0;n<2;n++)d.renderSample(ram);
  assert(d.voice[0].releasing && d.voice[0].env<=before);
  // The following new KON must clear ENDX and restart BRR from sample zero.
  d.writeReg(0x5c,0,ram);d.writeReg(0x4c,1,ram);
  for(unsigned n=0;n<2;n++)d.renderSample(ram);
  assert(d.voice[0].active && !d.voice[0].releasing && d.voice[0].keyStartDelay>=3);
  // BRR ENDX visible one sample AFTER the last decoder step, not on it.
  SpcDsp e;std::vector<std::uint8_t> er(65536);setup(e,er,true);
  e.writeReg(0x4c,1,er);
  for(unsigned n=0;n<20;n++){e.renderSample(er);assert((e.readReg(0x7c)&1)==0);}
  e.renderSample(er); // 5 silent and 16 BRR samples (end reached)
  assert(e.pendingEndx==1 && !(e.readReg(0x7c)&1));
  e.renderSample(er);
  assert((e.readReg(0x7c)&1)==1);
  e.writeReg(0x4c,1,er);
  for(unsigned n=0;n<2;n++)e.renderSample(er);
  assert((e.readReg(0x7c)&1)==0);
  // END without LOOP keeps a silent voice, with delayed ENDX visibility.
  SpcDsp stop;std::vector<std::uint8_t> sr(65536);setup(stop,sr,false);
  stop.writeReg(0x4c,1,sr);
  for(unsigned n=0;n<21;n++)stop.renderSample(sr);
  assert(stop.voice[0].active && stop.voice[0].releasing && stop.voice[0].env==0 && (stop.readReg(0x7c)&1)==0 && stop.pendingEndx==1);
  stop.renderSample(sr);
  assert((stop.readReg(0x7c)&1)==1);
  // A soft reset invalidates a queued start; it must not resume after RESET clears.
  SpcDsp reset;std::vector<std::uint8_t> rr(65536);setup(reset,rr,true);
  reset.writeReg(0x4c,1,rr);reset.writeReg(0x6c,0x80,rr);
  reset.writeReg(0x6c,0,rr);
  for(unsigned n=0;n<8;n++)reset.renderSample(rr);
  assert(!reset.voice[0].active && reset.pendingKeyOn==0);
  // Legacy immediate write path remains available for older ports.
  SpcDsp legacy;std::vector<std::uint8_t> lr(65536);setup(legacy,lr,true);
  legacy.hardwareKeyTiming=false;
  legacy.writeReg(0x4c,1,lr);
  assert(legacy.voice[0].active && legacy.voice[0].keyStartDelay==0);
  // Sample chunking must not change KON polling or the ENDX staging.
  SpcDsp one,two;std::vector<std::uint8_t> ra(65536),rb(65536);
  setup(one,ra,true);setup(two,rb,true);
  one.writeReg(0x4c,1,ra);two.writeReg(0x4c,1,rb);
  const auto joined=one.render(ra,80);
  const auto chunk1=two.render(rb,37),chunk2=two.render(rb,43);
  std::vector<std::int16_t> split=chunk1;split.insert(split.end(),chunk2.begin(),chunk2.end());
  assert(joined==split && one.readReg(0x7c)==two.readReg(0x7c));
  std::cout<<"DSP KON/KOFF poll, five-sample setup, BRR ENDX, compatibility and chunking PASS\n";
}
