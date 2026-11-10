#include "runtime.hpp"
#include <iostream>
#include <chrono>
#include <algorithm>
static volatile std::uint64_t sink;
#ifdef _MSC_VER
#define FORJA65_NOINLINE __declspec(noinline)
#else
#define FORJA65_NOINLINE __attribute__((noinline))
#endif
static void setFlag(const char*k,const char*v){
#ifdef _WIN32
 _putenv_s(k,v);
#else
 setenv(k,v,1);
#endif
}
FORJA65_NOINLINE static long long run(bool enabled){
 setFlag("FORJA65_PPU_FAST_DATA",enabled?"1":"0");SnesRuntime hw;hw.headless=true;
 const auto start=std::chrono::steady_clock::now();
 for(unsigned i=0;i<2000000;i++)hw.ppuPortWrite((i&8)?0x2104:0x2122,(std::uint8_t)i);
 const auto end=std::chrono::steady_clock::now();sink=hw.ppu.oam[0]+hw.ppu.cgram[0]+hw.hwUsage.ppuWrites;
 return std::chrono::duration_cast<std::chrono::microseconds>(end-start).count();
}
int main(){for(unsigned n=0;n<7;n++){auto a=run(false);auto b=run(true);std::cout<<a<<" "<<b<<"\n";}}
