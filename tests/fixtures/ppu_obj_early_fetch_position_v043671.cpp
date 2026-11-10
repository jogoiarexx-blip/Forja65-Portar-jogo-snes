#include "runtime.hpp"
#include <algorithm>
#include <cstdint>
#include <iostream>
#include <memory>
#include <stdexcept>
static void need(bool ok,const char* message){if(!ok)throw std::runtime_error(message);}
static std::unique_ptr<SnesRuntime> prepare(unsigned count=1){
 auto h=std::make_unique<SnesRuntime>();h->headless=true;h->beginFrame();
 auto& p=h->ppu;p.forceBlank=false;p.tm=0;p.ts=0;p.brightness=15;p.obsel=0x40;
 std::fill(p.oam.begin(),p.oam.end(),0);
 for(unsigned i=0;i<128;i++){p.oam[4*i]=16;p.oam[4*i+1]=200;}
 for(unsigned i=0;i<count;i++){
  p.oam[4*i]=16;p.oam[4*i+1]=41;
  p.oam[512+(i>>2)]|=(std::uint8_t)(2u<<((i&3u)*2));
 }
 h->beginScanline(40);h->setMasterCycle(0);
 h->wramRefreshAppliedThisLine=true;h->hdmaExecutedThisLine=true;
 return h;
}
int main(){try{
 unsigned cases=0;
 // The first sprite (#0) position must be sampled when H reaches 272.
 {
  auto h=prepare();h->advanceCpuMasterCycles(1088);
  need(h->objFetchSlots==0&&h->objFetchSpriteLoaded,"missing position latch at H272");cases++;
  need(h->objFetchSpriteX==16&&h->objFetchSpriteWidth==64,"wrong position/size at H272");cases++;
  h->ppu.oam[0]=255;h->advanceCpuMasterCycles(64);
  need(h->objFetchSlivers==8,"post-latch OAM change altered already sampled sprite width/position");cases++;
  need(h->objFetchSpriteX==16,"post-latch OAM change altered stored position");cases++;
 }
 // Modifications before H272 must still be observed.
 {
  auto h=prepare();h->advanceCpuMasterCycles(1087);h->ppu.oam[0]=255;
  h->advanceCpuMasterCycles(1);
  need(h->objFetchSpriteLoaded&&h->objFetchSpriteX==255,"pre-latch position write lost");cases++;
  h->advanceCpuMasterCycles(64);
  need(h->objFetchSlivers==1,"edge-position sprite fetched too many tiles");cases++;
 }
 // A high-OAM size change after the position fetch must not change width.
 {
  auto h=prepare();h->advanceCpuMasterCycles(1088);
  h->ppu.oam[512]=0;h->advanceCpuMasterCycles(8);
  need(h->objFetchSpriteWidth==64&&h->objFetchSlivers==1,"high OAM changed sampled sprite size");cases++;
 }
 // Selection uses index order, not whichever OAM cell was modified last.
 {
  auto h=prepare(2);h->advanceCpuMasterCycles(1088);
  need(h->objEvalSelectedCount==2&&h->objFetchSpritePos==0,"unexpected OBJ evaluation selection");cases++;
  need(h->objFetchSpriteX==16,"wrong first OBJ selection");cases++;
  h->ppu.oam[4]=255;h->advanceCpuMasterCycles(8);
  need(h->objFetchSlivers==1,"selected first OBJ position not latched");cases++;
 }
 // No OAM sampling while forced blank; skipped slots cannot replay.
 {
  auto h=prepare();h->ppu.forceBlank=true;
  h->advanceCpuMasterCycles(1096);
  need(!h->objFetchSpriteLoaded&&h->objFetchSlots==1,"blanked OBJ position/slot captured");cases++;
  h->ppu.forceBlank=false;h->advanceCpuMasterCycles(8);
  need(h->objFetchSlots==2,"blanked slot replayed");cases++;
 }
 // A new scanline resets the latch, and fresh OAM values are observed.
 {
  auto h=prepare();h->advanceCpuMasterCycles(1088);
  need(h->objFetchSpriteLoaded,"initial latch missing");cases++;
  h->beginScanline(41);h->wramRefreshAppliedThisLine=true;h->hdmaExecutedThisLine=true;
  need(!h->objFetchSpriteLoaded&&h->objFetchSlots==0,"scanline inherited old OBJ latch");cases++;
  h->ppu.oam[0]=32;h->advanceCpuMasterCycles(1088);
  need(h->objFetchSpriteX==32,"new scanline did not sample new X");cases++;
 }
 // Advancing with small and large chunks yields the same final state.
 {
  auto a=prepare(),b=prepare();
  a->advanceCpuMasterCycles(1360);
  for(unsigned k=0;k<170;k++)b->advanceCpuMasterCycles(8);
  need(a->objFetchSlivers==b->objFetchSlivers&&a->objFetchSlots==b->objFetchSlots,"chunk-dependent OBJ fetch result");cases++;
  need(a->ppu.objRangeTimeFlags==b->ppu.objRangeTimeFlags,"chunk-dependent OBJ overflow flags");cases++;
 }
 std::cout<<"PPU_OBJ_EARLY_FETCH_POSITION_V043671_PASS cases="<<cases<<"\n";
 return 0;
 }catch(const std::exception& e){std::cerr<<"PPU_OBJ_EARLY_FETCH_POSITION_V043671_FAIL "<<e.what()<<"\n";return 1;}
}
