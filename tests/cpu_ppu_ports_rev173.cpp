#include "runtime.hpp"
#include <cassert>
#include <iostream>
int main(){
  CpuState cpu;
  cpu.m8=true;cpu.decimalMode=true;cpu.c=false;cpu.a=0xAB99;
  cpu.adc(0x01);
  assert(cpu.a==0xAB00 && cpu.c && cpu.z && !cpu.n);
  cpu.a=0x0000;cpu.c=true;cpu.sbc(0x01);
  assert(cpu.a==0x0099 && !cpu.c && cpu.n);
  cpu.e=true;cpu.c=false;cpu.x=0x1234;cpu.xce();
  assert(!cpu.e && cpu.c);
  // REV174: XCE enters emulation only when the incoming carry is set.
  cpu.x8=false;cpu.x=0x1234;cpu.c=true;cpu.xce();
  assert(cpu.e && !cpu.c && cpu.x8 && cpu.x==0x0034);
  PpuState p;p.forceBlank=true;
  p.vram[0]=0x11;p.vram[2]=0x22;p.vram[4]=0x33;
  p.write(0x2115,0x00);p.write(0x2116,0);p.write(0x2117,0);
  assert(p.read(0x2139)==0x11 && p.vmadd==1);
  assert(p.read(0x2139)==0x11 && p.vmadd==2); // delayed word latch
  assert(p.read(0x2139)==0x22 && p.vmadd==3);
  p.write(0x2115,0x80);p.write(0x2116,0);p.write(0x2117,0);
  assert(p.read(0x213A)==0 && p.vmadd==1);
  assert(p.read(0x213A)==0 && p.vmadd==2);
  p.write(0x2121,5);p.write(0x2122,0x34);p.write(0x2122,0xAB);
  assert(p.cgram[10]==0x34 && p.cgram[11]==0x2B);
  p.write(0x2121,5);
  assert(p.read(0x213B)==0x34 && p.read(0x213B)==0x2B);
  std::cout<<"REV173 CPU decimal/XCE and PPU VRAM/CGRAM latch PASS\n";
}
