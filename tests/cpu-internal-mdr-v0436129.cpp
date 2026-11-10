#include "runtime.hpp"
#include <iostream>
#include <cstdint>
#include <array>
struct Score{unsigned passed=0,failed=0;void check(bool ok){if(ok)++passed;else ++failed;}};
int main(){
 Score s;
 constexpr std::array<unsigned,6> banks={0x00,0x10,0x3f,0x80,0xa4,0xbf};
 constexpr std::array<unsigned,12> offsets={0x4000,0x4016,0x4017,0x41ff,0x4200,0x4203,0x4210,0x4212,0x4214,0x4217,0x4302,0x43ff};
 constexpr std::array<unsigned,3> sentinels={0xa5,0x5a,0xc7};
 // S-CPU internal reads return the register value without driving the
 // external CPU memory data register. All CPU read-only/write-only MMIO
 // readbacks are covered by the bus preservation rule.
 for(auto bank:banks)for(auto off:offsets)for(auto sentinel:sentinels){
  SnesRuntime h;h.headless=true;
  h.io.quotient=0x3f12u;h.io.remainder=0xbc34u;
  h.cpuDataBus=(std::uint8_t)sentinel;
  unsigned actual=h.read((bank<<16)|off);
  (void)actual;
  s.check(h.cpuDataBus==sentinel);
 }
 // External bus reads must continue to latch the last read value.
 for(auto sentinel:sentinels){
  SnesRuntime h;h.headless=true;
  h.ram[0x45]=0x19;h.cpuDataBus=(std::uint8_t)sentinel;
  unsigned v=h.read(0x7e0045u);
  s.check(v==0x19u);s.check(h.cpuDataBus==0x19u);
 }
 for(auto sentinel:sentinels){
  SnesRuntime h;h.headless=true;
  h.io.wramPortAddr=0x87;
  h.ram[0x87]=0x2du;h.cpuDataBus=(std::uint8_t)sentinel;
  unsigned v=h.read(0x002180u);
  s.check(v==0x2du);s.check(h.cpuDataBus==0x2du);
 }
 // Writes into internal I/O do drive the data bus (unlike CPU reads).
 for(auto bank:banks){
  SnesRuntime h;h.headless=true;
  h.cpuDataBus=0xf1u;h.write8((bank<<16)|0x4202u,0x39u);
  s.check(h.cpuDataBus==0x39u);
 }
 // Read from WRAM mapped in low banks updates MDR as well.
 for(auto bank:banks){
  SnesRuntime h;h.headless=true;
  h.ram[0x125u]=0x6cu;h.cpuDataBus=0xeeu;
  unsigned v=h.read((bank<<16)|0x0125u);
  s.check(v==0x6cu);s.check(h.cpuDataBus==0x6cu);
 }
 std::cout<<"CPU_INTERNAL_MDR_REV129 pass="<<s.passed<<" fail="<<s.failed<<" total="<<(s.passed+s.failed)<<"\n";
 return s.failed?1:0;
}
