#include "runtime.hpp"
#include <iostream>
#include <stdexcept>
static void check(bool ok,const char* why){if(!ok)throw std::runtime_error(why);}
int main(int argc,char**argv){try{
  const bool storage=argc<2||std::string(argv[1])=="storage";
  unsigned vectors=0;
  SnesRuntime h;h.headless=true;
  for(unsigned bank:{0u,0x3fu,0x80u,0xbfu})for(unsigned ch=0;ch<8;ch++)for(unsigned value=0;value<256;value++){
    const unsigned base=(bank<<16)|0x4300|(ch<<4);
    h.ram[0x700]=value^0xff;
    if(storage){h.write8(base+0xb,value);h.ram[0x700]=value^0xff;h.read(0x7e0700);
    check(h.read(base+0xf)==value,"43xB storage not mirrored by 43xF");
    h.write8(base+0xf,value^0x5a);h.read(0x7e0700);
    check(h.read(base+0xb)==(value^0x5a),"43xF storage not mirrored by 43xB");
    }else for(unsigned r:{0xcu,0xdu,0xeu}){
      h.write8(base+r,value^0x33);h.read(0x7e0700);
      check(h.read(base+r)==(value^0xff),"unused DMA register did not preserve CPU bus latch");
    }
    check(h.dmaReadAbus(base+0xb)==0,"DMA A-bus incorrectly allowed CPU DMA-register read");
    vectors+=storage?3:4;
  }
  std::cout<<"DMA_REGISTER_DECODE_V043685_PASS group="<<(storage?"storage":"openbus")<<" vectors="<<vectors<<'\n';return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
