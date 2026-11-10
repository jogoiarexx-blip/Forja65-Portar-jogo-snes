#include "runtime.hpp"
#include <iostream>
#include <stdexcept>
static void must(bool value,const char*message){if(!value)throw std::runtime_error(message);}
static void put(PpuState&p,unsigned a,unsigned v){a&=65535u;p.vram[a]=v&255u;p.vram[(a+1u)&65535u]=(v>>8)&255u;}
static void setup(PpuState&p,unsigned mode){
 p.bgmode=mode;p.tm=3;p.ts=0;
 p.bgsc[0]=0x10;p.bgsc[1]=0x10;p.bgsc[2]=0x20;
 p.bgnba[0]=3;p.bgnba[1]=3;
 // BG1 / BG2: every 8px column has a different, solid 4bpp color.
 for(unsigned y=0;y<3;y++)for(unsigned x=0;x<32;x++)put(p,0x2000+(y*32+x)*2,(x+y*8)%15+1);
 for(unsigned tile=0;tile<32;tile++)for(unsigned yy=0;yy<8;yy++){
   unsigned v=tile%15;
   unsigned addr=0x6000+tile*32+yy*2;
   p.vram[addr]=(v&1)?255:0;p.vram[addr+1]=(v&2)?255:0;
   p.vram[addr+16]=(v&4)?255:0;p.vram[addr+17]=(v&8)?255:0;
 }
 for(unsigned i=0;i<256;i++){p.cgram[i*2]=i&255u;p.cgram[i*2+1]=0;}
}
static unsigned ci(const PpuState&p,unsigned bg,int x,int y,bool hires=false){return p.sampleBg(bg,x,y,4,0,hires).c15;}
int main(){try{
 PpuState p{};setup(p,2);
 must(ci(p,0,8,0)==2,"baseline tile 1 color");
 put(p,0x4000,0x2010); // First BG3 column: BG1 H offset 16 pixels
 must(ci(p,0,0,0)==1,"first visible column must be unshifted");
 must(ci(p,0,8,0)==4,"mode 2 horizontal offset applied to BG1");
 p.scrollX[0]=3;p.scrollX[2]=5;
 must(ci(p,0,8,0)==4,"low 3 bits retained from BG1 HOFS, not BG3 HOFS");
 p.scrollX[0]=p.scrollX[2]=0;
 must(ci(p,1,8,0)==2,"BG2 ignores BG1 valid flag");
 put(p,0x4000,0x4010); // BG2 H offset
 must(ci(p,1,8,0)==4,"BG2 horizontal offset flag");
 must(ci(p,0,8,0)==2,"BG1 ignores BG2 valid flag");
 put(p,0x4000,0);put(p,0x4000+64,0x2008);
 must(ci(p,0,8,0)==10,"mode 2 vertical offset from second BG3 map row");
 // V must be independent of the scanline used to fetch the offset word.
 must(ci(p,0,8,2)==10,"BG3 offset row constant along screen y");
 p.bgmode=4;put(p,0x4000,0xA008);
 must(ci(p,0,8,0)==10,"mode 4 bit15 vertical selection");
 put(p,0x4000,0x2010);
 must(ci(p,0,8,0)==4,"mode 4 horizontal selection");
 p.bgmode=1;
 must(ci(p,0,8,0)==2,"mode 1 unaffected by offset table");
 p.bgmode=2;put(p,0x4000,0x2010);put(p,0x4000+64,0);
 PpuState::BgTileRows rows{};
 for(int x=0;x<96;x++){
    auto a=p.sampleBg(0,x,0,4);
    auto b=p.sampleBg(0,x,0,4,0,false,false,&rows[0]);
    must(a.valid==b.valid&&a.c15==b.c15&&a.priority==b.priority,"offset cache/pixel equivalence");
 }
 p.bgmode=6;
 // ares fetchNameTable: hpixel + HLOOKUP + (doubled HOFS & 7).
 // x=16 + HLOOKUP=16 -> output x=32 -> entry 2 -> CHR 3.
 must(ci(p,0,16,0,true)==3,"mode 6 offset column at x=16 hires output");
 std::cout<<"PPU_OFFSET_TILE_PASS mode2 H/V, BG1/BG2, mode4 direction, mode1 guard, cache, mode6\n";
}catch(const std::exception&e){std::cerr<<"PPU_OFFSET_TILE_FAIL: "<<e.what()<<"\n";return 1;}}
