#include "runtime.hpp"
#include <cassert>
#include <iostream>
int main(int argc,char**argv){
 if(argc>1&&std::string(argv[1])=="blend"){
  for(int a=0;a<32;a++)for(int b=0;b<32;b++)for(bool sub:{false,true})for(bool half:{false,true}){
   int expected=sub?std::max(0,a-b):a+b;if(half)expected>>=1;expected=std::min(31,expected);
   auto packed=[](int x){return std::uint16_t(x|(x<<5)|(x<<10));};
   if(PpuState::blend15(packed(a),packed(b),sub,half)!=packed(expected)){std::cerr<<"blend mismatch a="<<a<<" b="<<b<<" half="<<half<<" subtract="<<sub<<"\n";return 1;}
  }std::cout<<"blend: PASS 4096 vectors\n";return 0;
 }
 if(argc>1&&std::string(argv[1])=="windows"){
  PpuState p;p.brightness=15;p.cgram[0]=20;p.fixedR=8;p.cgadsub=0x60;p.cgwsel=0x30;
  // Math disabled by color window: preserve main, including the half flag.
  assert(p.finalMain15(0,0)==20);
  p.cgwsel=2; // Empty subscreen uses COLDATA, with halve suppressed.
  assert(p.finalMain15(0,0)==28);
  p.cgwsel=0xc0; // Clip main to black: halve must be suppressed.
  assert(p.finalMain15(0,0)==8);
  std::cout<<"color window/subscreen backdrop: PASS\n";return 0;
 }
 // Direct HDMA crosses $7E:FFFF inside the two-byte pattern; next byte
 // must come from $7E:0000, never $7F:0000.
 for(bool native:{false,true})for(bool indirect:{false,true}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.ppu.forceBlank=true;h.beginFrame();h.currentScanline=225;h.currentMasterCycle=100;
  auto&d=h.dma[0];d.dmap=1|(indirect?0x40:0);d.bbad=0x26;d.a1b=0x7e;d.a2a=0xffff;d.dasb=0x7e;d.das=0xffff;h.ram[0xffff]=12;h.ram[0]=34;h.ram[0x10000]=56;
  h.hdmaActive=1;d.ntrl=2;h.hdmaLines[0]=2;h.hdmaTransfer[0]=true;h.executeHdmaLine();
  if(h.ppu.wh[0]!=12||h.ppu.wh[1]!=34){std::cerr<<"HDMA payload escaped bank native="<<native<<" indirect="<<indirect<<" value="<<unsigned(h.ppu.wh[1])<<"\n";return 1;}
  assert((indirect?d.das:d.a2a)==1);
  // The two-byte indirect pointer itself also wraps inside A1B.
  if(indirect){h.hdmaActive=1;h.hdmaLines[0]=0;d.a2a=0xfffe;h.ram[0xfffe]=2;h.ram[0xffff]=0x00;h.ram[0]=0x80;h.ram[0x10000]=0x90;h.ram[0x8000]=7;h.ram[0x8001]=9;h.reloadHdmaChannel(0);h.executeHdmaLine();assert(h.ppu.wh[0]==7&&h.ppu.wh[1]==9);assert(d.das==0x8002);}
 }std::cout<<"HDMA bank-wrap: PASS direct/indirect native/fallback\n";
}
