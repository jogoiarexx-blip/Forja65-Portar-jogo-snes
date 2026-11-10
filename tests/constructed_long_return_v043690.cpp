#include "runtime.hpp"
#include <cassert>
#include <iostream>
int main(){
  SnesRuntime hw;hw.mapper=MapperKind::LoROM;
  hw.cart.assign(0x8000,0xEA);hw.romLogicalSize=hw.cart.size();
  // $00:8100 PHK; $00:8101 PEA #$8107; $00:8104 JMP [$1864]
  hw.cart[0x100]=0x4B;hw.cart[0x101]=0xF4;hw.cart[0x102]=0x07;
  hw.cart[0x103]=0x81;hw.cart[0x104]=0xDC;
  hw.cart[0x105]=0x64;hw.cart[0x106]=0x18;hw.cart[0x108]=0x60;
  CpuState cpu;cpu.e=false;cpu.pb=0;cpu.s=0x1FC;
  cpu.push16Value(hw,0x8002);hw.pushNativeReturn(0x008003,false,cpu);
  cpu.push8Value(hw,0);cpu.push16Value(hw,0x8107);
  const auto reads=hw.hwUsage.wramReads;hw.cpuDataBus=0xA5;
  assert(hw.armConstructedLongReturn(0x008104,cpu));
  assert(hw.hwUsage.wramReads==reads&&hw.cpuDataBus==0xA5);
  assert(!hw.consumeConstructedLongReturn(0x008109,cpu));
  assert(hw.consumeConstructedLongReturn(0x008108,cpu));
  cpu.pop16Value(hw);cpu.pop8Value(hw);
  assert(hw.nativeReturnMatches(0x008003,false,cpu));
  cpu.pop16Value(hw);hw.popNativeReturn();assert(hw.nativeReturns.empty());
  // Arming is metadata validation, never an extra I/O read of a native stack.
  cpu.e=false;cpu.s=0x217d;cpu.pb=0;
  hw.nativeReturns.clear();hw.nativeReturns.push_back({0x008003,false,0x2180,true,1,0});
  hw.io.wramPortAddr=0x40;hw.ram[0x40]=0;
  assert(!hw.armConstructedLongReturn(0x008104,cpu));
  assert(hw.io.wramPortAddr==0x40);
  std::cout<<"CONSTRUCTED_LONG_RETURN_GENERATOR_PASS\n";
}
