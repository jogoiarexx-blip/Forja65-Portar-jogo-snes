#include "runtime.hpp"
#include <cstdint>
#include <iostream>
#include <chrono>
#include <stdexcept>
// REV138: o brilho mestre age no dominio de 5 bits: round(c*br/15), depois 5->8 bits (bsnes lightTable, Snes9x mul_brightness).
static std::uint32_t reference(std::uint16_t c,unsigned br){
  auto q=[&](unsigned v){return ((v*br*2u+15u)/30u)*255u/31u;};
  unsigned red=q(c&31u),green=q((c>>5)&31u),blue=q((c>>10)&31u);
  return 0xff000000u|(red<<16)|(green<<8)|blue;
}
int main(){
 try {
   PpuState p;
   std::uint64_t cases=0;
   for(unsigned brightness=0;brightness<16;++brightness){
     p.brightness=static_cast<std::uint8_t>(brightness);
     for(unsigned color=0;color<32768;++color){
       auto got=p.rgba15(static_cast<std::uint16_t>(color));
       auto expected=reference(static_cast<std::uint16_t>(color),brightness);
       if(got!=expected){std::cerr<<"PPU_LUT_MISMATCH color="<<color<<" brightness="<<brightness<<'\n';return 2;}
       ++cases;
     }
   }
   p.brightness=13;
   volatile std::uint64_t guard=0;
   constexpr unsigned samples=4000000;
   const auto t0=std::chrono::steady_clock::now();
   for(unsigned i=0;i<samples;i++)guard=guard+reference(static_cast<std::uint16_t>((i*33u)^((i>>3)*659u)),13);
   const auto t1=std::chrono::steady_clock::now();
   for(unsigned i=0;i<samples;i++)guard=guard+p.rgba15(static_cast<std::uint16_t>((i*33u)^((i>>3)*659u)));
   const auto t2=std::chrono::steady_clock::now();
   const auto us1=std::chrono::duration_cast<std::chrono::microseconds>(t1-t0).count();
   const auto us2=std::chrono::duration_cast<std::chrono::microseconds>(t2-t1).count();
   std::cout<<"PPU_BRIGHTNESS_LUT_PASS cases="<<cases<<" scalar_us="<<us1<<" lut_us="<<us2<<" guard="<<guard<<'\n';
   return 0;
 }catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}
}
