#include "runtime.hpp"
#include <cassert>
#include <iostream>
#ifdef _WIN32
static void setFlag(const char*k,const char*v){_putenv_s(k,v);}
#else
static void setFlag(const char*k,const char*v){setenv(k,v,1);}
#endif
static void same(const SnesRuntime&a,const SnesRuntime&b){
 assert(a.ppu.oam==b.ppu.oam);assert(a.ppu.cgram==b.ppu.cgram);assert(a.ppu.vram==b.ppu.vram);
 assert(std::equal(std::begin(a.ppu.regs),std::end(a.ppu.regs),std::begin(b.ppu.regs)));
 assert(a.ppu.oamAddr==b.ppu.oamAddr&&a.ppu.oamFlip==b.ppu.oamFlip&&a.ppu.oamReadFlip==b.ppu.oamReadFlip);
 assert(a.ppu.oamWriteRegister==b.ppu.oamWriteRegister);
 assert(a.ppu.cgAddr==b.ppu.cgAddr&&a.ppu.cgHigh==b.ppu.cgHigh&&a.ppu.cgSavedByte==b.ppu.cgSavedByte);
 assert(a.ppu.ppu1OpenBus==b.ppu.ppu1OpenBus&&a.ppu.ppu2OpenBus==b.ppu.ppu2OpenBus);
 assert(a.objEvalCursor==b.objEvalCursor&&a.objEvalSelectedCount==b.objEvalSelectedCount&&a.objEvalInRange==b.objEvalInRange);
 assert(a.objFetchSlots==b.objFetchSlots&&a.objFetchSlivers==b.objFetchSlivers);
 assert(a.cpuMasterClock==b.cpuMasterClock&&a.currentMasterCycle==b.currentMasterCycle);
 assert(a.framebufferHash()==b.framebufferHash());
}
int main(){
 setFlag("FORJA65_PPU_REGISTER_PROFILE","1");setFlag("FORJA65_PPU_FAST_DATA","0");SnesRuntime ref;
 setFlag("FORJA65_PPU_FAST_DATA","1");SnesRuntime fast;
 ref.headless=fast.headless=true;
 unsigned cases=0;
 for(unsigned addr=0;addr<512;addr++)for(unsigned phase=0;phase<2;phase++){
  for(auto*h:{&ref,&fast}){
   h->ppuPortWrite(0x2102,(std::uint8_t)addr);h->ppuPortWrite(0x2103,(std::uint8_t)(0x80|(addr>>8)));
   if(phase)(void)h->ppuPortRead(0x2138);
   for(unsigned i=0;i<7;i++){h->ppuPortWrite(0x2104,(std::uint8_t)(i*37+addr));if(i==3)(void)h->ppuPortRead(0x2138);}
  }
  same(ref,fast);cases++;
 }
 for(unsigned addr=0;addr<256;addr++)for(unsigned phase=0;phase<2;phase++){
  for(auto*h:{&ref,&fast}){
   h->ppuPortWrite(0x2121,(std::uint8_t)addr);if(phase)(void)h->ppuPortRead(0x213B);
   for(unsigned i=0;i<7;i++){h->ppuPortWrite(0x2122,(std::uint8_t)(addr+i*37));if(i==3)(void)h->ppuPortRead(0x213B);}
  }
  same(ref,fast);cases++;
 }
 // A fast path must actually bypass general register dispatch, not just have a flag.
 assert(ref.hwUsage.ppuNativeWrites==0);
 assert(fast.ppuOamFastWrites==7u*1024u&&fast.ppuCgramFastWrites==7u*512u);
 assert(fast.ppuOamLatchRasterSkips>0);
 assert(fast.hwUsage.ppuNativeWrites==7u*(1024u+512u));
 assert(ref.hwUsage.ppuFallbackWrites>fast.hwUsage.ppuFallbackWrites);
 // The first OAM byte in the low table is latch-only. Defer the raster work
 // until the committing write, while high-table bytes must synchronize now.
 for(bool high:{false,true}){
  for(auto*h:{&ref,&fast}){
   h->beginFrame();h->ppuPortWrite(0x2100,0x0f);h->currentScanline=40;h->currentMasterCycle=100;h->rasterCursorX=0;
   h->ppuPortWrite(0x2102,0);h->ppuPortWrite(0x2103,high?1:0);h->rasterCursorX=0;
   h->ppuPortWrite(0x2104,0x35);
  }
  assert(ref.rasterCursorX>0);
  assert(high?fast.rasterCursorX>0:fast.rasterCursorX==0);
  for(auto*h:{&ref,&fast}){h->currentMasterCycle=104;h->ppuPortWrite(0x2104,0x42);h->finishVisibleLine(40);}
  same(ref,fast);cases++;
 }
 // Exercise both DMA backends and all eight B-bus transfer patterns.
 for(bool nativeDma:{false,true})for(unsigned port:{4u,0x22u})for(unsigned mode=0;mode<8;mode++){
  setFlag("FORJA65_PPU_FAST_DATA","0");SnesRuntime a;
  setFlag("FORJA65_PPU_FAST_DATA","1");SnesRuntime b;
  for(auto*h:{&a,&b}){
   h->headless=true;h->nativeDmaEnabled=nativeDma;h->ppu.forceBlank=true;
   for(unsigned i=0;i<1024;i++)h->ram[0x1000+i]=(std::uint8_t)(i*29+mode);
   h->ppuPortWrite(0x2102,0xfe);h->ppuPortWrite(0x2103,0x81);h->ppuPortWrite(0x2121,0xff);
   h->dma[0].dmap=(std::uint8_t)mode;h->dma[0].bbad=(std::uint8_t)port;
   h->dma[0].a1b=0x7e;h->dma[0].a1t=0x1000;h->dma[0].das=257;h->executeDma(1);
  }
  same(a,b);assert(a.dma[0].a1t==b.dma[0].a1t&&a.dma[0].das==b.dma[0].das);
  assert(a.apu.masterObserved==b.apu.masterObserved);cases++;
 }
 // Palette commits must take effect at the exact same raster pixel.
 // Random memory supplies nontrivial BG/OBJ/window/color-math inputs.
 for(unsigned scenario=0;scenario<24;scenario++){
  setFlag("FORJA65_PPU_FAST_DATA","0");SnesRuntime a;
  setFlag("FORJA65_PPU_FAST_DATA","1");SnesRuntime b;
  for(auto*h:{&a,&b}){
   h->headless=true;h->beginFrame();unsigned rng=1234+scenario;
   auto rnd=[&](){rng=rng*1664525u+1013904223u;return (std::uint8_t)(rng>>24);};
   for(auto&v:h->ppu.vram)v=rnd();
   for(auto&v:h->ppu.oam)v=rnd();
   for(auto&v:h->ppu.cgram)v=rnd();
   h->ppu.bgmode=(std::uint8_t)(scenario%8);h->ppu.tm=0x1f;h->ppu.ts=0x1f;h->ppu.brightness=15;h->ppu.forceBlank=false;
   h->ppu.bgsc[0]=0x40;h->ppu.bgnba[0]=1;h->ppu.cgadsub=0x3f;
   h->beginScanline(40);h->wramRefreshAppliedThisLine=true;h->hdmaExecutedThisLine=true;
   for(unsigned i=0;i<48;i++){
    h->setMasterCycle(40+i*16);
    if(i%8==0){h->ppuPortWrite(0x2121,(std::uint8_t)(i+scenario));h->ppuPortWrite(0x2102,(std::uint8_t)i);h->ppuPortWrite(0x2103,(std::uint8_t)(scenario&1));}
    if(i%5==0)(void)h->ppuPortRead(0x2138);
    if(i%7==0)(void)h->ppuPortRead(0x213b);
    h->ppuPortWrite(i%3==0?0x2104:0x2122,(std::uint8_t)(i*31+scenario));
   }
   h->finishVisibleLine(40);
  }
  same(a,b);cases++;
 }
 std::cout<<"PPU_DATA_FASTPATH_REV159_PASS cases="<<cases<<" direct_writes="<<fast.hwUsage.ppuNativeWrites<<"\n";
}
