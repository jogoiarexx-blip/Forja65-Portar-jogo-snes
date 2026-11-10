#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>

static void ptr(std::vector<std::uint8_t>&ram,unsigned page,unsigned src,unsigned start,unsigned loop){
  unsigned base=((page<<8)+(src<<2))&0xffffu;
  ram[base]=std::uint8_t(start);ram[(base+1)&0xffffu]=std::uint8_t(start>>8);
  ram[(base+2)&0xffffu]=std::uint8_t(loop);ram[(base+3)&0xffffu]=std::uint8_t(loop>>8);
}
static void block(std::vector<std::uint8_t>&ram,unsigned addr,unsigned header,unsigned nib){
  ram[addr&0xffffu]=std::uint8_t(header);
  for(unsigned j=1;j<9;j++)ram[(addr+j)&0xffffu]=std::uint8_t((nib<<4)|nib);
}
static void advance(SpcDsp&d,std::vector<std::uint8_t>&ram,unsigned i,unsigned count){
  for(unsigned j=0;j<count;j++)(void)d.nextSample(i,ram);
}
int main(){
  unsigned cases=0;
  // Each voice rereads the sample directory once the original END+LOOP block ends.
  for(bool accurate:{false,true})for(unsigned voice=0;voice<8;voice++)
  for(unsigned test=0;test<4;test++)for(unsigned variant=0;variant<32;variant++){
    SpcDsp dsp;dsp.hardwareKeyTiming=accurate;
    dsp.interpolation=SpcDsp::Interpolation::Linear;
    std::vector<std::uint8_t> ram(65536,0);
    unsigned initialPage=2u,initialSrc=voice;
    unsigned start=0x1000+voice*0x60,oldLoop=0x5000+voice*0x60;
    unsigned target=0x8000+variant*0x50;
    unsigned newPage=4u,newSrc=(voice+1u)&7u;
    ptr(ram,initialPage,initialSrc,start,oldLoop);
    ptr(ram,newPage,newSrc,oldLoop,target);
    block(ram,start,0x23,1); // range=2, END+LOOP
    block(ram,oldLoop,0x03,2);
    block(ram,target,0x03,7);
    dsp.regs[0x5d]=std::uint8_t(initialPage);
    dsp.regs[(voice<<4)|4]=std::uint8_t(initialSrc);
    dsp.regs[(voice<<4)|2]=0;
    dsp.regs[(voice<<4)|3]=0x10; // exactly one BRR sample/frame
    dsp.keyOn(voice,ram);
    assert(dsp.voice[voice].loop==oldLoop);
    if(accurate)dsp.voice[voice].keyStartDelay=0;
    // Decode first BRR sample then change the loop destination during playback.
    advance(dsp,ram,voice,4);
    assert(dsp.voice[voice].addr==start+9);
    switch(test){
      case 0: ptr(ram,initialPage,initialSrc,start,target); break; // directory RAM changed
      case 1: dsp.regs[0x5d]=std::uint8_t(newPage);
              dsp.regs[(voice<<4)|4]=std::uint8_t(newSrc);break; // DIR and SRCN changed
      case 2: ptr(ram,initialPage,initialSrc,start,target);
              dsp.regs[(voice<<4)|4]=std::uint8_t(initialSrc);break; // no SRCN change
      default: ptr(ram,initialPage,initialSrc,start,target);
               dsp.regs[0x5d]=std::uint8_t(initialPage);break; // no DIR change
    }
    advance(dsp,ram,voice,12);
    assert(dsp.voice[voice].active);
    assert(dsp.voice[voice].loop==target);
    assert(dsp.voice[voice].addr==((target+9)&0xffffu));
    assert(dsp.voice[voice].decoded[0]==6); // 0x77 at range 0 -> PCM 6
    ++cases;
  }
  // Directory pointer wraps at the 64KiB SPC RAM boundary.
  for(bool accurate:{false,true})for(unsigned voice=0;voice<8;voice++){
    SpcDsp dsp;dsp.hardwareKeyTiming=accurate;
    dsp.interpolation=SpcDsp::Interpolation::Linear;
    std::vector<std::uint8_t> ram(65536);
    unsigned start=0x3400+voice*0x20;
    ptr(ram,0xff,0xff,start,0x6200);
    block(ram,start,0x23,1);block(ram,0x6200,0x03,2);block(ram,0x7100,0x03,7);
    dsp.regs[0x5d]=0xff;dsp.regs[(voice<<4)|4]=0xff;
    dsp.regs[(voice<<4)|3]=0x10;
    dsp.keyOn(voice,ram);
    if(accurate)dsp.voice[voice].keyStartDelay=0;
    advance(dsp,ram,voice,3);
    ptr(ram,0xff,0xff,start,0x7100);
    advance(dsp,ram,voice,13);
    assert(dsp.voice[voice].loop==0x7100&&dsp.voice[voice].addr==0x7109);
    ++cases;
  }
  // Hardware END without LOOP redirects silently; LOOP without END advances sequentially.
  for(unsigned voice=0;voice<8;voice++)for(unsigned flags:{1u,2u}){
    SpcDsp dsp;dsp.interpolation=SpcDsp::Interpolation::Linear;
    std::vector<std::uint8_t> ram(65536);
    const unsigned start=0x1200+voice*0x20;
    ptr(ram,2,voice,start,0x7000);
    block(ram,start,0x20|flags,1);
    block(ram,start+9,0x03,3);
    block(ram,0x7000,0x03,7);
    dsp.regs[0x5d]=2;dsp.regs[(voice<<4)|4]=std::uint8_t(voice);
    dsp.regs[(voice<<4)|3]=0x10;
    dsp.keyOn(voice,ram);
    advance(dsp,ram,voice,16);
    if(flags==1){assert(dsp.voice[voice].active&&dsp.voice[voice].releasing&&dsp.voice[voice].env==0);assert(dsp.voice[voice].addr==0x7009);}else{
      assert(dsp.voice[voice].active);
      assert(dsp.voice[voice].addr==start+18); // sequential BRR data
    }
    ++cases;
  }
  std::cout<<"DSP_LIVE_BRR_LOOP_V043641_PASS cases="<<cases
           <<" voices=8 legacy_and_reference=1 mid_note_DIR_SRCN_RAM=1 wrap=1\n";
}
