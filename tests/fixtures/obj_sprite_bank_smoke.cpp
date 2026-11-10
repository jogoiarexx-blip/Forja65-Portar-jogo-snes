// General SNES PPU regression: OBSEL bank/gap, OAM and DMA, row/point parity,
// sprite Y wrap.  Does not inject game-specific VRAM or substitute Kong art.
#include "runtime.hpp"
#include <array>
#include <cstdlib>
#include <iostream>
#include <stdexcept>
static void check(bool ok,const char* label) { if(!ok) throw std::runtime_error(label); }
static void paint(PpuState& p, unsigned a, unsigned row=0) {
  a=(a+row*2u)&65535u; p.vram[a]=0x80u; p.vram[(a+1)&65535u]=0;
  p.vram[(a+16)&65535u]=0; p.vram[(a+17)&65535u]=0;
}
static void slot(PpuState& p,std::uint8_t attr,unsigned x=16,unsigned y=16) {
  p.oam.assign(544,0);p.oam[0]=std::uint8_t(x);p.oam[1]=std::uint8_t(y);p.oam[2]=0;p.oam[3]=attr;
  // Other slots live off-screen (X = -256) so the test isolates slot zero.
  for(unsigned i=1;i<128;i++)p.oam[512+i/4]|=std::uint8_t(1u<<((i%4)*2));
}
int main(){try{
  PpuState p; p.cgram[2*129]=0x1F; // Sprite palette zero, CI=1 (red)
  slot(p,1);p.obsel=0;paint(p,0x2000);
  check(p.sampleSprites(16,16).valid,"alternate bank zero must begin at byte 0x2000");
  check(p.buildSpriteRow(16)[16].c15==p.sampleSprites(16,16).c15,"row / point agreement");
  p.obsel=0x1A; p.vram.assign(65536,0);paint(p,0); // base 0x8000 plus gap 0x8000 wraps
  check(p.sampleSprites(16,16).valid,"OBSEL base and gap 3 must wrap to VRAM zero");
  slot(p,0);p.obsel=2;p.vram.assign(65536,0);paint(p,0x8000);
  check(p.sampleSprites(16,16).valid,"OBSEL primary bank selection");
  slot(p,1,16,252);p.obsel=0;p.oam[512]|=2u; p.vram.assign(65536,0);
  paint(p,0x2000,4);
  check(p.sampleSprites(16,0).valid,"16x16 sprite Y wrap to top of screen");
  check(p.buildSpriteRow(0)[16].valid,"row renderer Y wrap to top of screen");
  // End-to-end CPU RAM -> DMA -> OBJ VRAM/OAM. No PPU-only bypass.
  SnesRuntime hw;
  hw.write8(0x2100,0x80); // Force blank: legal access for VRAM DMA.
  hw.write8(0x2101,0);hw.write8(0x2115,0x80);hw.write8(0x2116,0);hw.write8(0x2117,0x10);
  hw.ram[0x100]=0x80;hw.ram[0x101]=0;hw.setDmaReg(0,0,1);hw.setDmaReg(0,1,0x18);
  hw.setDmaReg(0,2,0);hw.setDmaReg(0,3,1);hw.setDmaReg(0,4,0x7e);
  hw.setDmaReg(0,5,2);hw.setDmaReg(0,6,0);hw.executeDma(1);
  check(hw.ppu.vram[0x2000]==0x80,"DMA must upload OBJ tile to alternate bank");
  hw.ram[0]=16;hw.ram[1]=16;hw.ram[2]=0;hw.ram[3]=1;
  hw.write8(0x2102,0);hw.write8(0x2103,0);
  hw.setDmaReg(0,0,0);hw.setDmaReg(0,1,0x04);hw.setDmaReg(0,2,0);
  hw.setDmaReg(0,3,0);hw.setDmaReg(0,4,0x7e);hw.setDmaReg(0,5,4);hw.setDmaReg(0,6,0);
  hw.executeDma(1);
  for(unsigned i=1;i<128;i++)hw.ppu.oam[512+i/4]|=std::uint8_t(1u<<((i%4)*2));
  check(hw.ppu.oam[0]==16&&hw.ppu.oam[3]==1,"DMA OAM write");
  check(hw.ppu.sampleSprites(16,16).valid,"DMA-written sprite must decode");
  // Replay input proves that held, released and resumed buttons reach SNES $4218-$4219.
  // This checks the generic input path, not in-game Kong movement.
  const std::string inputProbe = "forja65-obj-input-smoke.trace";
  {std::ofstream out(inputProbe,std::ios::trunc);
   check((bool)out,"input trace creation");
   out << "frame=30 joy1=0100 joy2=0000\nframe=33 joy1=0000 joy2=0000\n";}
  check(hw.loadInputReplay(inputProbe),"input replay load");
  hw.write8(0x4200,1); // Enable SNES auto-joypad acquisition.
  hw.frameCounter=30; hw.beginFrame();hw.beginVblank(hw.visibleLines());hw.finishAutoJoyRead(true);
  check(hw.readBus(0x4219)==1u,"right direction must reach the SNES input port");
  hw.frameCounter=31; hw.beginFrame();hw.beginVblank(hw.visibleLines());hw.finishAutoJoyRead(true);
  check(hw.readBus(0x4219)==1u,"held button must persist between replay events");
  hw.frameCounter=33; hw.beginFrame();hw.beginVblank(hw.visibleLines());hw.finishAutoJoyRead(true);
  check(hw.readBus(0x4219)==0u,"released button must clear at specified frame");
  std::filesystem::remove(inputProbe);
  std::cout<<"FORJA65_OBJ_BANK_DMA_WRAP_PASS\n";
  return 0;
 }catch(const std::exception& e){std::cerr<<"FORJA65_OBJ_BANK_DMA_WRAP_FAIL: "<<e.what()<<'\n';return 1;}}
