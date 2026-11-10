#include "runtime.hpp"
#include <algorithm>
#include <cstdint>
#include <iostream>
#include <memory>
#include <stdexcept>
static void need(bool ok,const char* message){if(!ok)throw std::runtime_error(message);}
static std::unique_ptr<SnesRuntime> makeHw(unsigned sprites,unsigned x=16u){
 auto hw=std::make_unique<SnesRuntime>();hw->headless=true;hw->beginFrame();
 auto& p=hw->ppu;p.forceBlank=false;p.tm=0;p.ts=0;p.brightness=15;p.obsel=0x40; // large = 64x64
 std::fill(p.oam.begin(),p.oam.end(),0);
 for(unsigned i=0;i<128;i++){p.oam[4u*i]=16;p.oam[4u*i+1u]=200u;}
 for(unsigned i=0;i<sprites;i++){
   p.oam[4u*i]=(std::uint8_t)x;p.oam[4u*i+1u]=41;
   p.oam[512u+(i>>2)]|=(std::uint8_t)(2u<<((i&3u)*2u));
 }
 hw->beginScanline(40);hw->setMasterCycle(0);hw->wramRefreshAppliedThisLine=true;hw->hdmaExecutedThisLine=true;
 return hw;
}
int main(){try{
 unsigned cases=0;
 // 34 fetch slots begin at dot 272; first slot finishes at 274.
 {
   auto h=makeHw(5);
   h->advanceCpuMasterCycles(1095);
   need(h->objFetchSlots==0,"slot processed before dot 274");cases++;
   h->advanceCpuMasterCycles(1);
   need(h->objFetchSlots==1&&h->objFetchSlivers==1,"first tile not fetched at dot 274");cases++;
   h->advanceCpuMasterCycles(8);
   need(h->objFetchSlots==2&&h->objFetchSlivers==2,"second tile not fetched at dot 276");cases++;
   h->advanceCpuMasterCycles(1359-1104);
   need(h->objFetchSlots==33&&!(h->ppu.objRangeTimeFlags&0x80u),"early Time Over");cases++;
   h->advanceCpuMasterCycles(1);
   need(h->objFetchSlots==34&&h->objFetchSlivers==34,"34 fetch slots not consumed");cases++;
   need((h->ppu.objRangeTimeFlags&0x80u)!=0,"Time Over not flagged with a pending 35th tile");cases++;
 }
 // An OAM edit cannot re-count slivers already fetched.
 for(unsigned newX:{252u,255u}){
   auto h=makeHw(5);
   h->advanceCpuMasterCycles(1096);
   need(h->objFetchSlivers==1,"first tile not latched");cases++;
   h->ppu.oam[4u*4u]=(std::uint8_t)newX; // reverse-ordered sprite #4 is being fetched
   h->advanceCpuMasterCycles(264);
   need((h->ppu.objRangeTimeFlags&0x80u)!=0,"mid-fetch OAM write retroactively erased fetched tiles");cases++;
 }
 // A position edit after H272 must NOT alter the first OBJ, even before its first tile finishes.
 {
   auto h=makeHw(5);
   h->advanceCpuMasterCycles(1090); // selected, position sampled at H272; no tile finished
   h->ppu.oam[4u*4u]=252;
   h->advanceCpuMasterCycles(270);
   need((h->ppu.objRangeTimeFlags&0x80u)!=0,"post-position-latch OAM edit rewrote fetched sprite");cases++;
 }
 // Do not fetch tiles in forced blank, or replay skipped fetch slots later.
 {
   auto h=makeHw(5);h->advanceCpuMasterCycles(1096);
   h->ppu.forceBlank=true;h->advanceCpuMasterCycles(160);
   const auto fetched=h->objFetchSlivers;
   need(fetched==1,"forced blank fetched OBJ tiles");cases++;
   h->ppu.forceBlank=false;h->advanceCpuMasterCycles(104);
   need(h->objFetchSlots==34,"forced blank fetch slots not consumed");cases++;
   need((h->ppu.objRangeTimeFlags&0x80u)==0,"forced blank created phantom Time Over");cases++;
 }
 // Exactly four 64px sprites = 32 tiles: never Time Over.
 {
   auto h=makeHw(4);h->advanceCpuMasterCycles(1360);
   need(h->objFetchSlivers==32&&!(h->ppu.objRangeTimeFlags&0x80u),"32-tile boundary overflow");cases++;
 }
 // New scanline must not inherit the prior HBlank fetch cursor.
 {
   auto h=makeHw(5);h->advanceCpuMasterCycles(1360);
   h->beginScanline(41);
   need(h->objFetchSlots==0&&h->objFetchSlivers==0&&!h->objFetchSpriteLoaded,"fetch cursor not reset per line");cases++;
 }
 std::cout<<"PPU_OBJ_HBLANK_INCREMENTAL_FETCH_V043670_PASS cases="<<cases<<"\n";
 return 0;
 }catch(const std::exception& e){std::cerr<<"PPU_OBJ_HBLANK_INCREMENTAL_FETCH_V043670_FAIL "<<e.what()<<"\n";return 1;}}
