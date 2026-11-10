#pragma once
#include "runtime.hpp"

  // REV190: B9:E03C calls an indexed JSR whose callee begins with PLX
  // at B9:E7B6. PLX discards the JSR return word, so the callee's RTL at
  // B9:E7DD returns through the enclosing JSL from B5:F195 instead.
  // Retire the stale short bookkeeping ONLY if both tracked frames, the
  // physical 65816 stack and the immutable ROM instructions agree.
inline bool retirePlxDiscardedJsrLongReturn(SnesRuntime& hw, std::uint32_t source,
                                       std::uint32_t destination,
                                       const CpuState& cpu){
    if((source!=0xB9E7DDu && source!=0xB9E7CFu)||destination!=0xB5F199u||
       cpu.e||cpu.pb!=0xB9||hw.nativeReturns.size()<2u)return false;
    const auto& shortFrame=hw.nativeReturns.back();
    const auto& outer=hw.nativeReturns[hw.nativeReturns.size()-2u];
    if(shortFrame.longCall||!shortFrame.stackTracked||
       shortFrame.target!=0xB9E03Fu||shortFrame.syntheticArmed||
       outer.longCall!=true||!outer.stackTracked||
       outer.target!=destination||outer.syntheticArmed||
       outer.stackPointer!=cpu.s||
       std::uint16_t(shortFrame.stackPointer+2u)!=cpu.s)return false;
    const auto op=[&](std::uint32_t address)->int{
      const auto offset=hw.romOffset(address);
      return offset==(std::size_t)-1||offset>=hw.cart.size()?-1:hw.cart[offset];
    };
    const std::pair<std::uint32_t,int> proof[]={
      {0xB5F195u,0x22},{0xB5F196u,0x00},
      {0xB5F197u,0xE0},{0xB5F198u,0xB9},
      {0xB9E03Cu,0xFC},{0xB9E03Du,0x42},{0xB9E03Eu,0xE0},
      {0xB9E7B6u,0xFA},{0xB9E7CFu,0x6B},{0xB9E7DDu,0x6B}};
    for(const auto& check:proof)if(op(check.first)!=check.second)return false;
    if(cpu.peekStack16(hw)!=0xF198u||
       cpu.peekStack8(hw,3u)!=0xB5u)return false;
    hw.nativeReturns.resize(hw.nativeReturns.size()-2u);
    hw.nativeReturnedCall=0;
    hw.pruneWramTailAuthorizations();
    return true;
  }
