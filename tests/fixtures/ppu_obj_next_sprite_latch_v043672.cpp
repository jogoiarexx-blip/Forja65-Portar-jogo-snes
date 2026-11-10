#include "runtime.hpp"
#include <algorithm>
#include <iostream>
#include <memory>
#include <stdexcept>
static void need(bool condition,const char* what){if(!condition)throw std::runtime_error(what);}
static std::unique_ptr<SnesRuntime> make(unsigned count=2){
  auto h=std::make_unique<SnesRuntime>();h->headless=true;h->beginFrame();
  auto& p=h->ppu;p.forceBlank=false;p.tm=0;p.ts=0;p.brightness=15;p.obsel=0;
  std::fill(p.oam.begin(),p.oam.end(),0);
  for(unsigned i=0;i<128;i++){p.oam[4*i]=16;p.oam[4*i+1]=200;}
  for(unsigned i=0;i<count;i++){p.oam[4*i]=16;p.oam[4*i+1]=41;}
  h->beginScanline(40);h->setMasterCycle(0);
  h->wramRefreshAppliedThisLine=true;h->hdmaExecutedThisLine=true;
  return h;
}
int main(){try{
 unsigned cases=0;
 // Selected order #1 then #0: as soon as #1 completes at H=274,
 // #0's position/size must be latched before its first tile completes.
 {
  auto h=make();h->advanceCpuMasterCycles(1096);
  need(h->objFetchSlivers==1&&h->objFetchSpritePos==1,"next sprite not selected after first slot");++cases;
  need(h->objFetchSpriteLoaded&&h->objFetchSpriteX==16&&h->objFetchSpriteWidth==8,"next sprite not captured on boundary");++cases;
  h->ppu.oam[0]=240;h->ppu.oam[512]|=1u;h->advanceCpuMasterCycles(8);
  need(h->objFetchSlivers==2,"late OAM change rewrote captured next sprite");++cases;
 }
 // A write *before* the boundary remains visible to that sprite.
 {
  auto h=make();h->advanceCpuMasterCycles(1095);h->ppu.oam[0]=240;h->ppu.oam[512]|=1u;
  h->advanceCpuMasterCycles(1);
  need(h->objFetchSpriteLoaded&&h->objFetchSpriteX==-16,"pre-boundary OAM write lost");++cases;
  h->advanceCpuMasterCycles(8);
  need(h->objFetchSlivers==1,"offscreen next sprite consumed a visible sliver");++cases;
 }
 // A large sprite consumes its whole width before moving to the next.
 {
  auto h=make();h->ppu.obsel=0x40;
  h->ppu.oam[512]|=(std::uint8_t)(2u<<2); // selected sprite #1 is 64 pixels
  h->advanceCpuMasterCycles(1096);
  need(h->objFetchSpritePos==0&&h->objFetchSpriteLoaded&&h->objFetchSpriteWidth==64,"latched next sprite prematurely");++cases;
  h->advanceCpuMasterCycles(56);
  need(h->objFetchSpritePos==1&&h->objFetchSpriteLoaded&&h->objFetchSpriteWidth==8,"next sprite not captured at final large-sprite sliver");++cases;
 }
 // Boundary capture applies to *every* subsequent sprite, not just #0.
 {
  auto h=make(3);h->advanceCpuMasterCycles(1096); // selected #2 consumed
  need(h->objFetchSpritePos==1&&h->objFetchSpriteX==16,"second sprite did not latch at first boundary");++cases;
  h->ppu.oam[4]=240;h->ppu.oam[512]|=(1u<<2); // #1 is now X=-16
  h->advanceCpuMasterCycles(8);
  need(h->objFetchSlivers==2&&h->objFetchSpritePos==2&&h->objFetchSpriteX==16,"third sprite not captured at next boundary");++cases;
  h->ppu.oam[0]=240;h->ppu.oam[512]|=1u;
  h->advanceCpuMasterCycles(8);
  need(h->objFetchSlivers==3,"late OAM change retroactively removed third sprite");++cases;
 }
 // High OAM size bits must be captured with X, not reevaluated later.
 {
  auto h=make();h->advanceCpuMasterCycles(1096);
  need(h->objFetchSpriteWidth==8,"wrong initial size at next-sprite boundary");++cases;
  h->ppu.oam[512]|=2u; // enlarge #0 *after* the latch
  h->advanceCpuMasterCycles(8);
  need(h->objFetchSlivers==2&&h->objFetchSpritePos==2,"post-boundary size changed fetched sliver count");++cases;
 }
 // Chunk sizes must not affect which X is captured.
 {
  auto a=make(),b=make();a->advanceCpuMasterCycles(1096);
  b->advanceCpuMasterCycles(1088);b->advanceCpuMasterCycles(8);
  need(a->objFetchSpritePos==b->objFetchSpritePos&&a->objFetchSpriteLoaded==b->objFetchSpriteLoaded&&a->objFetchSpriteX==b->objFetchSpriteX,"chunk-dependent position capture");++cases;
  a->ppu.oam[0]=240;b->ppu.oam[0]=240;a->ppu.oam[512]|=1u;b->ppu.oam[512]|=1u;
  a->advanceCpuMasterCycles(8);for(int k=0;k<8;k++)b->advanceCpuMasterCycles(1);
  need(a->objFetchSlivers==b->objFetchSlivers&&a->objFetchSlivers==2,"chunk-dependent completed fetch");++cases;
 }
 // Forced blank must not capture future sprite positions while disabled.
 {
  auto h=make();h->advanceCpuMasterCycles(1096);
  h->ppu.forceBlank=true;h->advanceCpuMasterCycles(8);
  need(h->objFetchSlots==2&&h->objFetchSlivers==1,"forced blank fetched extra tile");++cases;
 }
 // New scanline starts with a fresh cursor, not the previous sprite latch.
 {
  auto h=make();h->advanceCpuMasterCycles(1096);h->beginScanline(41);
  need(!h->objFetchSpriteLoaded&&h->objFetchSpritePos==0&&h->objFetchSlots==0,"next line inherited sprite latch");++cases;
 }
 std::cout<<"PPU_OBJ_NEXT_SPRITE_LATCH_V043672_PASS cases="<<cases<<"\n";
 return 0;
 }catch(const std::exception&e){std::cerr<<"PPU_OBJ_NEXT_SPRITE_LATCH_V043672_FAIL "<<e.what()<<"\n";return 1;}
}
