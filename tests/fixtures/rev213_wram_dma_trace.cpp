#include "runtime.hpp"
#include <iostream>
#include <stdexcept>
#include <string>
int main(int argc,char**argv){
  try{
    if(argc!=2)throw std::runtime_error("expected native|virtual");
    const bool native=std::string(argv[1])=="native";
    SnesRuntime h;h.headless=true;h.ppu.forceBlank=true;h.nativeDmaEnabled=native;
    h.sram.assign(0x8000,0);h.ram[0x500]=0x8a;h.io.wramPortAddr=0x500;
    auto&d=h.dma[0];d.a1b=0x70;d.a1t=0;d.bbad=0x80;d.das=1;d.dmap=0x80;
    h.executeDma(1);
    if(h.sram[0]!=0x8a||h.io.wramPortAddr!=0x501)
      throw std::runtime_error("reverse DMA payload differs from WMADD read");
    if(h.wramReadTraceCount!=1)
      throw std::runtime_error("reverse DMA lost WRAM reader attribution");
    std::cout<<"REV213_WRAM_DMA_TRACE_PASS mode="<<(native?"native":"virtual")<<" count="<<h.wramReadTraceCount<<'\n';
    return 0;
  }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
