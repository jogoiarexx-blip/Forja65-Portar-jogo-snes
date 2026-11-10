#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <iostream>
#include <initializer_list>
static ApuBridge setup(std::initializer_list<std::uint8_t> op) {
  ApuBridge s; s.correctedSpcSemantics=true; s.accurateSpcTiming=true;
  s.spc.control=0; s.spc.pc=0x200;
  std::uint16_t pc=0x200; for(auto b:op)s.spc.ram[pc++]=b;
  return s;
}
int main(){
  // [dp+X]: fetches the high pointer byte from the same direct-page bank.
  {
    auto s=setup({0xE7,0xFD,0x00}); s.spc.psw=CP; s.spc.x=2;
    s.spc.ram[0x1FF]=0x34; s.spc.ram[0x100]=0x12; s.spc.ram[0x1234]=0x9A;
    assert(forja65SpcStep(s)==6); assert(s.spc.pc==0x202);
    assert(s.spc.a()==0x9A);
  }
  // [dp]+Y: pointer is DP-wrapped and indexed after fetching the 16-bit address.
  {
    auto s=setup({0xF7,0xFF}); s.spc.psw=CP; s.spc.setY(2);
    s.spc.ram[0x1FF]=0xFE; s.spc.ram[0x100]=0x20; s.spc.ram[0x2100]=0xA9;
    assert(forja65SpcStep(s)==6 && s.spc.pc==0x202 && s.spc.a()==0xA9);
  }
  // ADC dp,dp: source first, destination second; carry and flags updated, A intact.
  {
    auto s=setup({0x89,0x10,0x20}); s.spc.setA(0xDE); s.spc.psw=CC;
    s.spc.ram[0x10]=2; s.spc.ram[0x20]=3;
    assert(forja65SpcStep(s)==6 && s.spc.pc==0x203);
    assert(s.spc.ram[0x20]==6 && s.spc.ram[0x10]==2 && s.spc.a()==0xDE);
  }
  // ADC dp,#imm and SBC dp,dp do not modify A.
  {
    auto s=setup({0x98,0x7F,0x20,0xA9,0x10,0x20}); s.spc.setA(0x55);
    s.spc.ram[0x20]=1; s.spc.ram[0x10]=5;
    assert(forja65SpcStep(s)==5 && s.spc.ram[0x20]==0x80 && s.spc.a()==0x55);
    s.spc.psw|=CC;
    assert(forja65SpcStep(s)==6 && s.spc.ram[0x20]==0x7B && s.spc.a()==0x55);
  }
  // ADC/SBC (X),(Y) use current direct-page bank and preserve accumulator.
  {
    auto s=setup({0x99,0xB9}); s.spc.psw=CP|CC; s.spc.x=0x44; s.spc.setY(0x55); s.spc.setA(0xFE);
    s.spc.ram[0x144]=10; s.spc.ram[0x155]=3;
    assert(forja65SpcStep(s)==5 && s.spc.ram[0x144]==14);
    s.spc.psw|=CC;
    assert(forja65SpcStep(s)==5 && s.spc.ram[0x144]==11 && s.spc.a()==0xFE);
  }
  // 16-bit MOVW at page 0x1FF wraps high byte to 0x100.
  {
    auto s=setup({0xBA,0xFF}); s.spc.psw=CP; s.spc.ram[0x1FF]=0xCD; s.spc.ram[0x100]=0xAB;
    assert(forja65SpcStep(s)==5 && s.spc.ya==0xABCD);
  }
  // Memory destination on second operand (OR dp,dp), comparison signedness unchanged.
  {
    auto s=setup({0x09,0x10,0x20,0x69,0x10,0x20}); s.spc.ram[0x10]=1; s.spc.ram[0x20]=2;
    assert(forja65SpcStep(s)==6 && s.spc.ram[0x10]==1 && s.spc.ram[0x20]==3);
    assert(forja65SpcStep(s)==6 && (s.spc.psw&CC)!=0);
  }
  // Stable mode retains previous behavior until real SNES trace validation.
  {
    auto s=setup({0xE7,0xFD,0x00});s.correctedSpcSemantics=false;
    s.spc.psw=CP;s.spc.x=2;s.spc.ram[0x1FF]=0x34;s.spc.ram[0x100]=0x12;s.spc.ram[0x1234]=0x9A;forja65SpcStep(s);
    assert(s.spc.pc==0x202); // Both paths consume one operand.
    assert(s.spc.a()!=0x9A); // The legacy path did not wrap the pointer high byte.
  }
  std::cout<<"SPC_SEMANTICS_PASS indexed_indirect=correct dp_wrap=correct adc_sbc_memory=correct stable_mode=preserved\n";
}
