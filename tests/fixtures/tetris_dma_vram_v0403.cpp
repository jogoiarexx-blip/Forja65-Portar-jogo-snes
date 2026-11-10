#include "runtime.hpp"
#include <stdexcept>
#include <iostream>
#include <string>
static void check(bool v,const char*m){if(!v)throw std::runtime_error(m);}
static void configure(SnesRuntime &h){
 h.headless=true;h.nativeDmaEnabled=true;h.ppuRegisterProfileEnabled=true;
 h.frameTimingActive=true;h.currentScanline=225;h.currentMasterCycle=0;
 h.ppu.write(0x2115u,0x80u);h.ppu.write(0x2116u,0xFEu);h.ppu.write(0x2117u,0x7Fu);
 for(int k=0;k<256;k++)h.ram[k]=(std::uint8_t)((k*29u+7u)&255u);
}
static void compare(const SnesRuntime&a,const SnesRuntime&b){
 check(a.ppu.vram==b.ppu.vram,"VRAM bytes differ");
 check(a.ppu.vmadd==b.ppu.vmadd&&a.ppu.vramReadBuffer==b.ppu.vramReadBuffer,"VRAM latch/address differs");
 check(a.ppu.vmain==b.ppu.vmain,"VMAIN differs");
 check(a.ppu.regs[0x18]==b.ppu.regs[0x18]&&a.ppu.regs[0x19]==b.ppu.regs[0x19],"port shadow differs");
 check(a.hwUsage.dmaBytes==b.hwUsage.dmaBytes,"DMA counts differ");
 check(a.cpuMasterClock==b.cpuMasterClock,"CPU master cycles differ");
 check(a.dma[0].a1t==b.dma[0].a1t&&a.dma[0].das==b.dma[0].das,"DMA post-registers differ");
}
int main(){try{
 for(int mode:{0,1,2,3,4,5,6,7})for(int increment:{0,0x80})for(int map:{0,4,8,12}){
  SnesRuntime generic,fast;configure(generic);configure(fast);
  generic.ppu.write(0x2115u,(std::uint8_t)(increment|map));fast.ppu.write(0x2115u,(std::uint8_t)(increment|map));
  generic.nativeDmaEnabled=false;
  for(auto*h:{&generic,&fast}){auto&d=h->dma[0];d.dmap=(std::uint8_t)mode;d.bbad=0x18;d.a1b=0x7E;d.a1t=0;d.das=128;}
  generic.executeDma(1);fast.executeDma(1);
  compare(generic,fast);check(fast.dmaVramFastBytes>0,"fast VRAM transfer not used");
 }
 // During active pixels, DMA must use raster-aware normal path.
 {
 SnesRuntime active;configure(active);active.currentScanline=18;active.currentMasterCycle=500;active.ppu.forceBlank=false;
 active.dma[0].dmap=1;active.dma[0].bbad=0x18;active.dma[0].a1b=0x7E;active.dma[0].das=8;
 active.executeDma(1);check(active.dmaVramFastBytes==0,"unsafe fast transfer during active display");
 }
 // Even-byte CGRAM write updates only the latch; no raster sync needed.
 {
 SnesRuntime optimized,baseline;
 for(auto*h:{&optimized,&baseline}){h->ppu.write(0x2100,0x0F);h->frameTimingActive=true;h->currentScanline=7;h->currentMasterCycle=625;h->framebuffer.assign(256*224,0xFF000000u);h->ppu.write(0x2121,0x24);}
 baseline.syncPpuBeforeMutation();baseline.ppu.write(0x2122,0x1F);
 optimized.ppuPortWrite(0x2122,0x1F);
 check(optimized.rasterCursorX==0,"first CGRAM byte flushed raster");
 check(optimized.ppu.cgram==baseline.ppu.cgram,"first CGRAM byte changed palette");
 baseline.currentMasterCycle=625;optimized.currentMasterCycle=625;
 baseline.syncPpuBeforeMutation();baseline.ppu.write(0x2122,0x03);
 optimized.ppuPortWrite(0x2122,0x03);
 check(optimized.ppu.cgram==baseline.ppu.cgram,"CGRAM commit differs");
 check(optimized.framebufferHash()==baseline.framebufferHash(),"CGRAM raster differs");
 }
 std::cout<<"TETRIS_DMA_VRAM_BATCH_PASS\n";return 0;
 }catch(const std::exception&e){std::cerr<<"TETRIS_DMA_VRAM_BATCH_FAIL "<<e.what()<<'\n';return 1;}}
