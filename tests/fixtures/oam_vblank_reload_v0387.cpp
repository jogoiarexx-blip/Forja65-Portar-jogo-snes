#include "runtime.hpp"
#include <iostream>
#include <memory>
#include <stdexcept>
static void need(bool v,const char* m){if(!v)throw std::runtime_error(m);}
int main(){try{
 unsigned cases=0;
 // Exercise both explicit vblank and the natural scanline transition.
 for(bool automatic:{false,true})for(bool forced:{false,true}){
  auto h=std::make_unique<SnesRuntime>();h->beginFrame();auto& p=h->ppu;
  p.write(0x2100,forced?0x8f:0x0f);p.write(0x2102,0x34);p.write(0x2103,0x81);
  p.oamAddr=99;p.oamFlip=true;p.oamReadFlip=true;
  if(automatic){
   h->currentScanline=h->visibleLines()-1;h->beginScanline(h->currentScanline);
   h->setMasterCycle(0);h->advanceCpuMasterCycles(1364);
  }else h->beginVblank(h->visibleLines());
  need(h->io.vblank,"vblank transition missing");++cases;
  if(forced)need(p.oamAddr==99&&p.oamFlip&&p.oamReadFlip,"forced blank must preserve cursor and flips");
  else need(p.oamAddr==0x134&&!p.oamFlip&&!p.oamReadFlip,"vblank must reload 9-bit saved address and reset byte phases");
  ++cases;
 }
 std::cout<<"OAM_VBLANK_RELOAD_V0387_PASS cases="<<cases<<"\n";
}catch(const std::exception& e){std::cerr<<e.what()<<"\n";return 1;}}
