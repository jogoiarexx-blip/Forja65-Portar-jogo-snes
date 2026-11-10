#include "runtime.hpp"
#include <cstdint>
#include <iostream>
#include <array>
struct Score {unsigned pass=0,fail=0;void check(bool ok){if(ok)++pass;else ++fail;}};
struct Reference {
 std::uint16_t q{},r{};std::uint32_t shift{};
 unsigned multiplication{},division{};
 void startMul(unsigned a,unsigned b){r=0;q=(std::uint16_t)((b<<8)|a);shift=b;multiplication=8;division=0;}
 void startDiv(unsigned dividend,unsigned divisor){r=(std::uint16_t)dividend;shift=divisor<<16;division=16;multiplication=0;}
 void edge(){if(multiplication){--multiplication;if(q&1)r=(std::uint16_t)(r+shift);q>>=1;shift<<=1;}
  if(division){--division;q=(std::uint16_t)(q<<1);shift>>=1;if(r>=shift){r=(std::uint16_t)(r-shift);q|=1;}}}
};
int main(){Score s;
 constexpr std::array<unsigned,8> factors={0,1,2,3,7,0x80,0xfe,0xff};
 constexpr std::array<unsigned,7> dividends={0,1,2,0x100,0x1234,0xfedc,0xffff};
 constexpr std::array<unsigned,6> divisors={0,1,2,3,0x7f,0xff};
 for(unsigned a:factors)for(unsigned b:factors){
  SnesRuntime h;h.headless=true;Reference ref;
  h.write8(0x004202u,(std::uint8_t)a);h.write8(0x004203u,(std::uint8_t)b);ref.startMul(a,b);
  for(unsigned k=0;k<=8;k++){
   s.check(h.io.quotient==ref.q);s.check(h.io.remainder==ref.r);
   if(k==8){s.check(h.io.remainder==(a*b));break;}
   h.addCpuInternalCycles(1);ref.edge();
  }
 }
 for(unsigned dividend:dividends)for(unsigned divisor:divisors){
  SnesRuntime h;h.headless=true;Reference ref;
  h.io.quotient=0xbad5u;ref.q=0xbad5u;
  h.write8(0x004204u,(std::uint8_t)dividend);
  h.write8(0x004205u,(std::uint8_t)(dividend>>8));
  h.write8(0x004206u,(std::uint8_t)divisor);
  ref.startDiv(dividend,divisor);
  for(unsigned k=0;k<=16;k++){
   s.check(h.io.quotient==ref.q);s.check(h.io.remainder==ref.r);
   if(k==16){s.check(h.io.quotient==(divisor?dividend/divisor:0xffffu));
      s.check(h.io.remainder==(divisor?dividend%divisor:dividend));break;}
   h.addCpuInternalCycles(1);ref.edge();
  }
 }
 // In a compiled SNES port, the instruction scheduler must advance ALU by
 // actual CPU cycles; DMA stall master clocks alone must not complete it.
 {SnesRuntime h;h.headless=true;h.write8(0x004202u,13);h.write8(0x004203u,17);
  s.check(h.io.remainder==0);
  h.advanceCpuMasterCycles(160u);
  s.check(h.io.remainder==0);
  h.advanceCpuInstruction(0x008000u,3u,1u,SnesRuntime::NO_TIMING_ADDR,0u,SnesRuntime::NO_TIMING_ADDR,0u,0u);
  s.check(h.io.remainder==85u);
  h.advanceCpuInstruction(0x008001u,5u,1u,SnesRuntime::NO_TIMING_ADDR,0u,SnesRuntime::NO_TIMING_ADDR,0u,0u);
  s.check(h.io.remainder==221);
 }
 // Five 5A22 ALU phases occur during the DRAM refresh hold, not 40.
 {SnesRuntime h;h.headless=true;h.beginFrame();h.currentScanline=1u;
  h.currentMasterCycle=SnesRuntime::WRAM_REFRESH_MC-2u;
  h.write8(0x004202u,0xffu);h.write8(0x004203u,2u);
  h.advanceCpuMasterCycles(2u);
  s.check(h.wramRefreshAppliedThisLine);
  s.check(h.io.remainder==2u*(0x1fu)); // lower five bits of 255
  h.addCpuInternalCycles(3u);
  s.check(h.io.remainder==510u);
 }
 // Multiplier and divider are a *shared* ALU: a busy write cannot start a
 // second concurrent job. Keep it explicit rather than inventing results.
 {SnesRuntime h;h.headless=true;h.write8(0x004202u,7);h.write8(0x004203u,9);
  h.write8(0x004204u,0x90);h.write8(0x004205u,0x01);h.write8(0x004206u,3);
  s.check(h.io.remainder==0x190u);
  h.addCpuInternalCycles(8);s.check(h.io.remainder==0x190u+63u);
 }
 std::cout<<"CPU_5A22_MATH_REV128 pass="<<s.pass<<" fail="<<s.fail<<" total="<<(s.pass+s.fail)<<"\n";
 return s.fail?1:0;
}
