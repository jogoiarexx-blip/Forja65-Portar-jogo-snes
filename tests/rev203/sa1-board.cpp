#include "forja_sa1.hpp"
#include <iostream>
#include <stdexcept>
static void check(bool x){if(!x)throw std::runtime_error("SA1 board regression");}
int main(){
 ForjaSa1 b;std::vector<std::uint8_t> rom(8*1024*1024),ram(32768);
 for(unsigned j=0;j<8;j++)rom[j*0x100000]=0x10+j;
 b.bind(rom,ram);
 check(b.read(false,0xc00000,0)==0x10);
 b.write(false,0x2220,0x83);check(b.read(false,0xc00000,0)==0x13);check(b.read(false,0x008000,0)==0x13);
 b.write(false,0x2220,3);check(b.read(false,0x008000,0)==0x10);
 b.write(false,0x003000,0xab);check(b.read(false,0x003000,0)==0);
 b.write(false,0x2229,1);b.write(false,0xbf3000,0xab);check(b.read(true,0,0)==0xab);check(b.read(false,0x003000,0)==0xab);
 b.write(true,0,0x44);check(b.read(false,0x003000,0)==0xab);
 b.write(true,0x222a,1);b.write(true,0,0x44);check(b.read(false,0x003000,0)==0x44);
 b.write(false,0x2203,0x34);b.write(false,0x2204,0x92);b.write(false,0x2200,0);check(b.resetPending);check(b.vector(3)==0x9234);check(b.reg[0x2a]==0);
 // Either CPU write-enable opens the shared protected BW-RAM, before physical mirroring.
 b.write(true,0x2227,0x80);b.write(false,0x400100,0x9a);check(ram[0x100]==0x9a);
 b.write(true,0x2227,0);b.write(false,0x400100,0x55);check(ram[0x100]==0x9a);
 b.write(false,0x2228,2);b.write(false,0x408100,0x66);check(ram[0x100]==0x66);
 b.write(false,0x2201,0x80);b.write(true,0x2209,0x8b);check(b.scpuIrq());check((b.read(false,0x2300,0)&0x8f)==0x8b);
 b.write(false,0x2202,0x80);check(!b.scpuIrq());
 b.write(true,0x2250,0);b.write(true,0x2251,0xfe);b.write(true,0x2252,0xff);b.write(true,0x2253,3);b.write(true,0x2254,0);check(b.result==0xfffffffaULL);
 b.write(true,0x2250,1);b.write(true,0x2251,0xf9);b.write(true,0x2252,0xff);b.write(true,0x2253,3);b.write(true,0x2254,0);check((b.result&0xffffffffu)==0x0002fffdu);
 check(b.read(false,0x2306,0x75)==0x75);check(b.read(false,0x230e,0x65)==0x65);
 std::cout<<"REV203_SA1_BOARD_PASS\n";
}
