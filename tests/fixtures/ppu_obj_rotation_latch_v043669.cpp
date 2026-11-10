#include "runtime.hpp"
#include <algorithm>
#include <cstdint>
#include <iostream>
#include <memory>
#include <stdexcept>
static void require(bool v,const char*msg){if(!v)throw std::runtime_error(msg);}
static void setup(SnesRuntime& hw){
  hw.headless=true;
  hw.beginFrame();
  hw.ppu.brightness=0;hw.ppu.tm=0;hw.ppu.ts=0;
  std::fill(hw.ppu.oam.begin(),hw.ppu.oam.end(),0);
  for(unsigned i=0;i<128;i++){hw.ppu.oam[i*4u+1u]=41;hw.ppu.oam[i*4u]=16;}
  hw.wramRefreshAppliedThisLine=true;hw.hdmaExecutedThisLine=true;
}
int main(){try{
  unsigned cases=0;
  for(unsigned start:{0u,1u,17u,63u,126u,127u}){
    auto hw=std::make_unique<SnesRuntime>();setup(*hw);
    hw->ppu.write(0x2102u,(std::uint8_t)(start*2u));hw->ppu.write(0x2103u,0x80u);
    hw->beginScanline(40);hw->advanceCpuMasterCycles(4);
    require(hw->objEvalSelectedCount==1u,"first sprite not evaluated");
    require(hw->objEvalSelected[0]==start,"first sprite wrong rotation");cases++;
    // Mid-scanline writes must affect the next scanline, not the current one.
    const unsigned changed=(start+51u)&127u;
    hw->ppu.write(0x2102u,(std::uint8_t)(changed*2u));hw->ppu.write(0x2103u,0x80u);
    hw->advanceCpuMasterCycles(8);
    require(hw->objEvalSelectedCount==2u,"second sprite not evaluated");
    require(hw->objEvalSelected[1]==((start+1u)&127u),"midline address rewound selection");cases++;
    // The PPU status read must not mutate the evaluation cursor.
    (void)hw->ppu.read(0x213e);
    hw->advanceCpuMasterCycles(8);
    require(hw->objEvalSelectedCount==3u,"third sprite not evaluated");
    require(hw->objEvalSelected[2]==((start+2u)&127u),"status read changed OBJ rotation");cases++;
    // Start the next line explicitly: skip unrelated CPU WRAM-refresh stalls.
    hw->beginScanline(41);hw->advanceCpuMasterCycles(4);
    require(hw->objEvalSelectedCount==1u,"next scanline first sprite missing");
    require(hw->objEvalSelected[0]==changed,"rotation did not update on next scanline");cases++;
  }
  // A forced-blanked scan cannot retroactively replay entries skipped earlier.
  {
    auto hw=std::make_unique<SnesRuntime>();setup(*hw);
    hw->ppu.write(0x2102u,26u);hw->ppu.write(0x2103u,0x80u);
    hw->ppu.forceBlank=true;hw->beginScanline(40);hw->advanceCpuMasterCycles(4);
    require(hw->objEvalCursor==1u&&hw->objEvalSelectedCount==0u,"forced blank advanced incorrectly");cases++;
    hw->ppu.write(0x2102u,140u);hw->ppu.forceBlank=false;hw->advanceCpuMasterCycles(8);
    require(hw->objEvalSelectedCount==1u&&hw->objEvalSelected[0]==14u,"forced blank replayed or rotated OBJ scan");cases++;
  }
  // Switching priority rotation during scanline must not rebase the current scan.
  {
    auto hw=std::make_unique<SnesRuntime>();setup(*hw);
    hw->ppu.write(0x2102u,100u);hw->ppu.write(0x2103u,0u);
    hw->beginScanline(40);hw->advanceCpuMasterCycles(4);
    require(hw->objEvalSelected[0]==0u,"disabled rotation did not start at OBJ zero");cases++;
    hw->ppu.write(0x2103u,0x80u);hw->advanceCpuMasterCycles(8);
    require(hw->objEvalSelected[1]==1u,"midline priority toggle rebased scan");cases++;
  }
  std::cout<<"PPU_OBJ_ROTATION_LATCH_V043669_PASS cases="<<cases<<"\n";
  return 0;
}catch(const std::exception&e){std::cerr<<"PPU_OBJ_ROTATION_LATCH_V043669_FAIL "<<e.what()<<"\n";return 1;}}
