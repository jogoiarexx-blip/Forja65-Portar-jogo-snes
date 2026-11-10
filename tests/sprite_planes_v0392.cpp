#include "runtime.hpp"
#include <iostream>
#include <cassert>
int main(){PpuState p;for(unsigned i=0;i<128;i++)p.oam[i*4+1]=100;p.oam[0]=0;p.oam[1]=0;p.vram[0]=255;p.cgram[258]=31;auto row=p.buildSpriteRow(0);assert(row[0].valid);
#ifdef FORJA65_TEST_VRAM_COUNT
std::cout<<"OBJ row VRAM reads="<<p.testReads<<"\n";if(p.testReads>4){std::cerr<<"OBJ row repeatedly fetches the same 4 plane bytes\n";return 1;}
#endif

 unsigned seed=123;auto rnd=[&](){seed=seed*1664525u+1013904223u;return seed>>24;};
 for(unsigned n=0;n<64;n++){for(auto&v:p.vram)v=rnd();for(auto&v:p.oam)v=rnd();for(auto&v:p.cgram)v=rnd();p.obsel=rnd();p.regs[3]=rnd();p.oamAddr=rnd();for(int y:{0,7,111,223,255}){auto r=p.buildSpriteRow(y);for(int x=0;x<256;x++){auto a=r[x],b=p.sampleSprites(x,y);assert(a.valid==b.valid);if(a.valid)assert(a.c15==b.c15&&a.objPal==b.objPal&&a.priority==b.priority&&a.oamIndex==b.oamIndex);}}}
 std::cout<<"OBJ cached/scalar equivalence PASS\n";
}
