#include "runtime.hpp"
#include <cassert>
#include <cstdint>
#include <iostream>

static unsigned location(unsigned word, unsigned high){
  return (word & 0x100u) ? (512u+((word&15u)<<1)+high) : (((word&255u)<<1)+high);
}
static void set_address(PpuState& p, unsigned address){
  p.write(0x2102u,(std::uint8_t)address);
  p.write(0x2103u,(std::uint8_t)(address>>8));
}
int main(){
  unsigned cases=0;
  for(unsigned address=0; address<512; ++address){
    const unsigned low=location(address,0),high=location(address,1);
    // A CPU write of the low byte, followed by an OAMDATAREAD, reads the
    // high byte of the *same* word, then advances the shared address.
    {
      PpuState p;set_address(p,address);
      p.oam[low]=0x39u;p.oam[high]=0xA5u;
      p.write(0x2104u,0x11u);
      assert(p.oamFlip && p.oamReadFlip && p.oamAddr==address);
      assert(p.read(0x2138u)==0xA5u);
      assert(!p.oamFlip && !p.oamReadFlip && p.oamAddr==((address+1u)&511u));
      ++cases;
    }
    // OAMDATAREAD low byte advances the same phase that OAMDATA uses.
    {
      PpuState p;set_address(p,address);
      p.oam[low]=0x52u;
      assert(p.read(0x2138u)==0x52u);
      assert(p.oamFlip && p.oamReadFlip);
      p.write(0x2104u,0x7Bu);
      assert(p.oamAddr==((address+1u)&511u));
      assert(!p.oamFlip && !p.oamReadFlip);
      ++cases;
    }
    // Unmixed reads still advance one byte at a time.
    {
      PpuState p;set_address(p,address);
      p.oam[low]=0x23u;p.oam[high]=0x91u;
      assert(p.read(0x2138u)==0x23u);
      assert(p.read(0x2138u)==0x91u);
      assert(p.oamAddr==((address+1u)&511u));
      ++cases;
    }
    // The second write still commits the low-OAM word atomically; high
    // OAM bytes are immediately written as per the existing implementation.
    {
      PpuState p;set_address(p,address);
      p.write(0x2104u,0x57u);
      p.write(0x2104u,0xC9u);
      assert(p.oam[low]==0x57u && p.oam[high]==0xC9u);
      assert(p.oamAddr==((address+1u)&511u));
      ++cases;
    }
  }
  // Resetting OAMADD or leaving forced blank resets BOTH access phases.
  for(unsigned address=0; address<512; ++address){
    PpuState p;set_address(p,address);
    p.read(0x2138u);
    assert(p.oamFlip);
    set_address(p,address);
    assert(!p.oamFlip && !p.oamReadFlip);
    p.write(0x2100u,0x80u);
    p.read(0x2138u);
    p.write(0x2100u,0x0Fu);
    assert(p.oamAddr==address && !p.oamFlip && !p.oamReadFlip);
    ++cases;
  }
  std::cout<<"PPU_OAM_SHARED_BYTE_CURSOR_V043664_PASS cases="<<cases<<"\n";
}
