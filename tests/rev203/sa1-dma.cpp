#include "forja_sa1.hpp"
#include <iostream>
#include <stdexcept>
#define check(x) do{if(!(x))throw std::runtime_error("SA1 regression line "+std::to_string(__LINE__));}while(false)
int main(){
 ForjaSa1 b;std::vector<std::uint8_t> rom(4194304),ram(32768);b.bind(rom,ram);
 for(unsigned i=0;i<16;i++)rom[0x100+i]=i+1;
 b.write(true,0x2230,0x80);b.write(true,0x2232,0);b.write(true,0x2233,0x81);b.write(true,0x2234,0);b.write(true,0x2238,16);b.write(true,0x2239,0);b.write(true,0x2235,0x40);b.write(true,0x2236,0);
 for(unsigned i=0;i<16;i++)check(b.iram[0x40+i]==i+1);
 check(b.dmaBytes==16&&(b.cf&0x20));
 // Read-modify-write on packed pixels keeps the neighboring pixels intact.
 b.write(true,0x600000,0xa);b.write(true,0x600001,0xb);check(ram[0]==0xba);
 b.write(true,0x223f,0x80);b.write(true,0x600002,1);check(ram[0]==0x9a);check(b.read(true,0x600000,0)==2);
 // One 2bpp row [0,1,2,3,0,1,2,3] transposes to $55,$33.
 b.write(true,0x2230,0);b.write(true,0x2231,2);b.write(true,0x2235,0x80);b.write(true,0x2236,0);b.write(true,0x2230,0xa0);
 for(unsigned x=0;x<8;x++)b.write(true,0x2240+x,x%4);
 check(b.iram[0x80]==0x55&&b.iram[0x81]==0x33);
 // Variable bits cross byte boundaries and advance only after the high read.
 rom[0x200]=0x96;rom[0x201]=0x35;rom[0x202]=0xab;
 b.write(true,0x2259,0);b.write(true,0x225a,0x82);b.write(true,0x225b,0);b.write(true,0x2258,3);
 check(b.read(true,0x230c,0)==0xb2);check(b.bitOffset==3);
 b.write(true,0x2258,0x85);b.read(true,0x230c,0);check(b.bitOffset==3);b.read(true,0x230d,0);check(b.bitOffset==0&&b.bitAddress==0x8201);
 std::cout<<"REV203_SA1_DMA_BITMAP_BITS_PASS\n";
}
