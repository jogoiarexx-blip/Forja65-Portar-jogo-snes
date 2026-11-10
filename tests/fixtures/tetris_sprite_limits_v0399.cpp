#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <iostream>

static void hiddenByRangeLimit(){
  PpuState p;
  // Sprite 32 is the only non-transparent one and must be dropped.
  for(unsigned i=0;i<128;i++){
    p.oam[4*i]=40;
    p.oam[4*i+1]=(i<33)?40:0;
    p.oam[4*i+2]=(i==32)?1:0;
  }
  p.vram[32]=0x80;p.cgram[2*129]=31;
  auto eval=p.evaluateSpriteSlivers(40);
  assert(eval.rangeOver&&eval.count==32&& !eval.timeOver);
  assert((p.read(0x213E)&0xC0u)==0x40u);
  assert(!p.sampleSprites(40,40).valid);
  assert(!p.buildSpriteRow(40)[40].valid);
}
static void hiddenOffscreenStillCounts(){
  PpuState p;
  for(unsigned i=0;i<128;i++)p.oam[4*i+1]=0;
  for(unsigned i=0;i<32;i++){
    p.oam[4*i]=0;
    p.oam[4*i+1]=50;
    p.oam[512+i/4]|=(std::uint8_t)(1u<<((i%4)*2u)); // X = -256
  }
  p.oam[128]=50;p.oam[129]=50;p.oam[130]=1;
  p.vram[32]=0x80;p.cgram[2*129]=31;
  auto eval=p.evaluateSpriteSlivers(50);
  assert(eval.rangeOver&&eval.count==32);
  assert(!p.buildSpriteRow(50)[50].valid);
}
static void timeLimitReversesPreference(){
  PpuState p;p.obsel=0xA0; // 32x32 small sprite = four slivers per scanline
  for(unsigned i=0;i<128;i++)p.oam[4*i+1]=0;
  for(unsigned i=0;i<10;i++){
    p.oam[4*i]=40;p.oam[4*i+1]=60;p.oam[4*i+2]=0;
  }
  p.vram[0]=0x80;p.cgram[2*129]=31;
  auto eval=p.evaluateSpriteSlivers(60);
  assert(!eval.rangeOver&&eval.timeOver&&eval.count==34);
  assert((p.read(0x213E)&0xC0u)==0x80u);
  // Tiles for sprites 9..2 are fetched first (32). Sprite 1 gets two;
  // sprite 0 gets none, despite having the highest OAM priority.
  auto at=p.sampleSprites(40,60);
  assert(at.valid&&at.oamIndex==1);
  assert(p.buildSpriteRow(60)[40].oamIndex==1);
}
static void flagsResetOnNewFrame(){
  SnesRuntime hw("assets/cart-data.bin",MapperKind::LoROM,0u,10u,0u,CartChip::None,"limits-smoke.srm",1u,true);
  hw.ppu.objRangeTimeFlags=0xC0u;hw.beginFrame();
  assert((hw.ppu.read(0x213E)&0xC0u)==0);
}
static void flippedTileSelection(){
  PpuState p;
  for(unsigned i=0;i<128;i++)p.oam[4*i+1]=0;
  p.oam[0]=16;p.oam[1]=20;p.oam[2]=0;p.oam[3]=0x40;
  p.oam[512]=2; // first sprite large 16x16
  p.vram[32]=0x01; // physical rightmost tile: rightmost pixel
  p.cgram[2*129]=31;
  auto row=p.buildSpriteRow(20);
  assert(row[16].valid&&row[16].oamIndex==0);
  assert(p.sampleSprites(16,20).c15==row[16].c15);
}
int main(){
  hiddenByRangeLimit();hiddenOffscreenStillCounts();timeLimitReversesPreference();flippedTileSelection();flagsResetOnNewFrame();
  std::cout<<"TETRIS_OBJ_32_RANGE_34_TIME_PRIORITY_FLIP_PASS\n";
}
