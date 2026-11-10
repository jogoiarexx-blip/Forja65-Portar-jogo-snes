#include "runtime.hpp"
#include <cstdio>
#include <cstdlib>
// Independent byte-address adapter of ares Background::fetchNameTable,
// commit 9408cb43d4948fc3ea6e152a307a34348df3fe04. See source notes and ISC notice.
// Covers stable registers, no mosaic/OPT. Does not call production samplers.
static PpuState::LayerPixel reference(const PpuState&p,unsigned bg,unsigned x,unsigned y,unsigned bpp){
 unsigned h=x+2u*p.scrollX[bg],v=y+p.scrollY[bg]+(p.bgFirstLineHidden?1u:0u);
 unsigned ht=h>>4,vt=v>>(((p.bgmode>>(4u+bg))&1u)?4:3);
 unsigned sc=p.bgsc[bg]&3u;
 unsigned entry=((vt&31u)*32u+(ht&31u));
 if((sc&1u)&&(ht&32u))entry+=1024u;
 if((sc&2u)&&(vt&32u))entry+=(sc&1u)?2048u:1024u;
 unsigned a=(((p.bgsc[bg]&252u)<<9)+entry*2u)&65535u;
 unsigned attr=p.vram[a]|(p.vram[(a+1u)&65535u]<<8);
 unsigned tile=attr&1023u;
 bool hf=attr&0x4000u,vf=attr&0x8000u;
 if(bool(h&8u)!=hf)tile++;
 if(((p.bgmode>>(4u+bg))&1u)&&bool(v&8u)!=vf)tile+=16u;
 unsigned py=(v&7u)^(vf?7u:0u),px=(h&7u)^(hf?7u:0u),ci=0;
 for(unsigned plane=0;plane<bpp;plane++){
  unsigned address=(((p.bgnba[bg]&7u)<<13)+(tile&1023u)*bpp*8u+py*2u+(plane/2u)*16u+(plane&1u))&65535u;
  ci|=((p.vram[address]>>(7u-px))&1u)<<plane;
 }
 unsigned index=((attr>>10)&7u)*(1u<<bpp)+ci;
 unsigned col=p.cgram[index*2u]|((p.cgram[index*2u+1u]&127u)<<8);
 return {(std::uint16_t)col,(std::uint8_t)bg,0,(std::uint8_t)((attr&0x2000u)?(bg?11u:15u):(bg?3u:7u)),255,ci!=0};
}
static unsigned rng=0x161u;
static unsigned next(){rng=rng*1664525u+1013904223u;return rng;}
int main(){unsigned checks=0,fail=0,cacheFail=0,renderFail=0;
 for(unsigned mode:{5u,6u})for(unsigned bg=0;bg<(mode==5?2u:1u);bg++)
 for(unsigned size=0;size<2;size++)for(unsigned sc=0;sc<4;sc++)for(unsigned flip=0;flip<4;flip++){
  PpuState p;p.bgmode=(std::uint8_t)(mode|(size<<(4+bg)));p.brightness=15;p.tm=1u<<bg;p.bgsc[bg]=(std::uint8_t)(0x60u|sc);p.bgnba[bg]=0;
  for(auto&b:p.vram)b=(std::uint8_t)(next()>>24);
  p.bgsc[2]=0x50;std::fill(p.vram.begin()+0xa000,p.vram.begin()+0xa800,0); // no valid OPT entries
  for(unsigned i=0;i<256;i++){p.cgram[i*2u]=i;p.cgram[i*2u+1u]=i>>3;}
  // Both screen boundaries, different attributes and tile pairs. Keep away
  // from the unrelated 10-bit CHR overflow rule to isolate these regressions.
  for(unsigned i=0;i<4096;i++){
   unsigned attr=(next()%700u)|((next()&7u)<<10)|(flip<<14)|((next()&1u)<<13);
   unsigned a=(0xc000u+i*2u)&65535u;p.vram[a]=attr;p.vram[a+1u]=attr>>8;
  }
  p.scrollX[bg]=(std::uint16_t)((sc*257u+flip*7u+size*3u)&1023u);
  p.scrollY[bg]=(std::uint16_t)(sc*239u+flip*13u);p.bgFirstLineHidden=true;
  unsigned bpp=bg?2u:4u;
  for(unsigned y:{0u,7u,8u,15u,31u,223u}){
   PpuState::BgTileCache cache{};std::vector<std::uint32_t> fb;
   // Segments restart cache at an unaligned output position.
   p.renderOutputSegment(fb,y,0,73);p.renderOutputSegment(fb,y,73,512);
   for(unsigned x=0;x<512;x++){
    const auto want=reference(p,bg,x,y,bpp),got=p.sampleBg(bg,x,y,bpp,0,true);
    const auto cached=p.sampleBg(bg,x,y,bpp,0,true,false,&cache);
    checks++;
    if(got.valid!=want.valid||(want.valid&&(got.c15!=want.c15||got.priority!=want.priority)))fail++;
    if(cached.valid!=got.valid||(got.valid&&(cached.c15!=got.c15||cached.priority!=got.priority)))cacheFail++;
    unsigned color=want.valid?want.c15:p.palette15(0);
    if(fb[y*512u+x]!=p.rgba15((std::uint16_t)color))renderFail++;
   }
  }
 }
 std::printf("PPU_HIRES_REV161 checks=%u address_fail=%u cache_fail=%u render_fail=%u\n",checks,fail,cacheFail,renderFail);
 return (fail||cacheFail||renderFail)?1:0;
}
