#include "runtime.hpp"
#ifdef FORJA65_PINNED_RECOUNT_ORACLE
#include "ppu_obj_direct_recount_v67.hpp"
#include <stdexcept>
#endif
#include <algorithm>
#include <cstdint>
#include <iostream>
#include <memory>
static std::unique_ptr<SnesRuntime> setup(){
 auto h=std::make_unique<SnesRuntime>();h->headless=true;h->beginFrame();
 h->ppu.obsel=0x40;h->ppu.forceBlank=false;h->ppu.brightness=15;
 std::fill(h->ppu.oam.begin(),h->ppu.oam.end(),0u);
 for(unsigned i=0;i<128u;i++){h->ppu.oam[4u*i]=16;h->ppu.oam[4u*i+1]=200;}
 for(unsigned i=0;i<5u;i++){
   h->ppu.oam[4u*i+1]=41;
   h->ppu.oam[512u+(i>>2)]|=(std::uint8_t)(2u<<((i&3u)*2u));
 }
 h->beginScanline(40);h->setMasterCycle(0);
 h->wramRefreshAppliedThisLine=true;h->hdmaExecutedThisLine=true;
 return h;
}
int main(){
#ifdef FORJA65_PINNED_RECOUNT_ORACLE
 try{
 auto control=setup();control->advanceCpuMasterCycles(1360);
 HistoricalDirectRecount stationary;
 stationary.oam=control->ppu.oam;stationary.obsel=control->ppu.obsel;
 if(!stationary.evaluateSpriteSlivers(41).timeOver || !(control->ppu.objRangeTimeFlags&0x80u))
  throw std::runtime_error("stationary overflow control failed");
 auto h=setup();h->advanceCpuMasterCycles(1096);
 h->ppu.oam[4u*4u]=252u;h->advanceCpuMasterCycles(264);
 HistoricalDirectRecount old;old.oam=h->ppu.oam;old.obsel=h->ppu.obsel;
 const auto recount=old.evaluateSpriteSlivers(41);
 const bool timed=(h->ppu.objRangeTimeFlags&0x80u)!=0;
 if(recount.count!=33u||recount.timeOver||!timed)
  throw std::runtime_error("retroactive recount differential failed");
 std::cout<<"OLD_MODEL_MID_FETCH_TIME_OVER="<<recount.timeOver<<" OLD_SLIVERS="<<recount.count
          <<" NEW_MID_FETCH_TIME_OVER="<<timed<<" CONTROL_BOTH_OVERFLOW=1\n";
 }catch(const std::exception&e){std::cerr<<e.what()<<"\n";return 1;}
#else
 auto h=setup();h->advanceCpuMasterCycles(1096);
 h->ppu.oam[4u*4u]=252u;h->advanceCpuMasterCycles(264);
 std::cout<<"MID_FETCH_TIME_OVER="<<((h->ppu.objRangeTimeFlags&0x80u)?1:0)<<"\n";
#endif
}
