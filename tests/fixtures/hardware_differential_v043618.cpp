#include "runtime.hpp"
#include "ares_micro_reference_v043618.hpp"
#include <iostream>
#include <memory>
#include <string>
#include <stdexcept>
using upstream_ares_reference::AresCpuReference;
using upstream_ares_reference::AresPpuReference;
static unsigned cases=0;static int failures=0;
static void check(bool okay,const std::string&label){++cases;if(!okay){++failures;std::cerr<<"DIVERGENCE "<<label<<'\n';}}
int main(){
 auto hw=std::make_unique<SnesRuntime>();auto ref=std::make_unique<AresCpuReference>();CpuState c;
 for(bool e:{false,true})for(unsigned d:{0x100u,0x11au,0x201u})for(unsigned x:{0u,0xeeu})for(unsigned op:{0xf6u,0xf7u}){
  c.e=e;c.d=d;c.x=x;c.db=0x7e;ref->EF=e;ref->D.w=d;
  for(unsigned a=0;a<8192;++a)hw->ram[a]=ref->memory[a]=std::uint8_t(a*13u+(a>>8)*37u);
  const auto expected=0x7e0000u|ref->readDirectX(op+x,0)|(unsigned(ref->readDirectX(op+x,1))<<8);
  check(c.addressDpIndirectX(*hw,op)==expected,"CPU (DP,X) E="+std::to_string(e)+" D="+std::to_string(d));
 }
 for(bool e:{false,true})for(unsigned s:{0x1feu,0x1ffu}){
  c.e=e;c.s=s;c.db=0;ref->EF=e;ref->S.w=s;ref->B=0;
  hw->ram[0x100]=ref->memory[0x100]=0x34;hw->ram[0x1ff]=ref->memory[0x1ff]=0;hw->ram[0x200]=ref->memory[0x200]=0x80;
  c.pop("PLB",*hw);ref->instructionPullB();check(c.s==ref->S.w&&c.db==ref->B&&c.z==ref->ZF&&c.n==ref->NF,"CPU PLB E="+std::to_string(e)+" S="+std::to_string(s));
 }
 for(unsigned cfg:{0u,1u,2u,4u,8u,12u,128u,129u,130u,132u,136u,140u})for(unsigned addr:{0u,0xffu,0x7fffu,0xffffu}){
  AresPpuReference p;auto h=std::make_unique<SnesRuntime>();h->frameTimingActive=true;h->currentScanline=h->visibleLines();p.line=225;
  for(unsigned a=0;a<32768;++a){const unsigned w=(a*53u+0xa512u)&65535u;p.vram[a]=w;h->ppu.vram[a*2]=std::uint8_t(w);h->ppu.vram[a*2+1]=std::uint8_t(w>>8);}
  auto write=[&](unsigned port,unsigned val){h->ppuPortWrite(std::uint16_t(port),std::uint8_t(val));p.write(port,std::uint8_t(val));};
  write(0x2100,0x0f);write(0x2115,cfg);write(0x2116,addr&255);write(0x2117,addr>>8);
  for(unsigned port:{0x2139u,0x213au,0x2139u,0x213au,0x2139u,0x213au}){
   const auto actual=h->ppuPortRead(std::uint16_t(port)),expected=p.read(port);
   check(actual==expected&&h->ppu.vmadd==unsigned(p.io.vramAddress)&&h->ppu.vramReadBuffer==unsigned(p.latch.vram),"PPU latch cfg="+std::to_string(cfg)+" addr="+std::to_string(addr));
  }
  // A valid buffered word can be returned after display becomes active; refills are blocked.
  h->currentScanline=18;h->currentMasterCycle=500;p.line=19;
  for(unsigned port:{0x2139u,0x213au,0x2139u,0x213au}){auto a=h->ppuPortRead(std::uint16_t(port)),b=p.read(port);check(a==b&&h->ppu.vramReadBuffer==unsigned(p.latch.vram),"PPU active refill");}
  // VMADD writes also refill: blocked during active display and HBlank.
  write(0x2116,0);write(0x2117,0);check(h->ppu.vramReadBuffer==unsigned(p.latch.vram),"PPU active address prefetch");
  h->currentMasterCycle=SnesRuntime::HBLANK_START_MC+8;write(0x2116,0);check(h->ppu.vramReadBuffer==unsigned(p.latch.vram),"PPU HBlank address prefetch");
  write(0x2100,0x80);write(0x2116,0);check(h->ppu.vramReadBuffer==unsigned(p.latch.vram),"PPU forced blank prefetch");
 }
 // Reverse DMA must observe the same blocked refill as CPU reads, in either backend.
 for(bool native:{false,true}){auto h=std::make_unique<SnesRuntime>();h->nativeDmaEnabled=native;h->frameTimingActive=true;h->currentScanline=18;h->currentMasterCycle=500;h->ppu.vram[0]=0x55;h->ppuPortWrite(0x2115,0);h->ppuPortWrite(0x2116,0);h->ppuPortWrite(0x2117,0);auto&d=h->dma[0];d.dmap=0x80;d.bbad=0x39;d.a1b=0x7e;d.a1t=0x1000;d.das=3;h->executeDma(1);check(h->ram[0x1000]==0&&h->ram[0x1001]==0&&h->ram[0x1002]==0,"DMA reverse active VRAM backend="+std::to_string(native));}
 if(failures){std::cerr<<"HARDWARE_DIFFERENTIAL_FAIL cases="<<cases<<" divergences="<<failures<<'\n';return 1;}
 std::cout<<"HARDWARE_DIFFERENTIAL_V043618_PASS cases="<<cases<<" cpu=ares-micro ppu=ares-micro dma=2\n";return 0;
}
