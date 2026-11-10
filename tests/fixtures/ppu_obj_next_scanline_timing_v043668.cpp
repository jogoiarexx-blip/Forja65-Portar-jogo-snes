#include "runtime.hpp"
#include <cstdint>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <vector>

static void check(bool ok,const char* msg){if(!ok)throw std::runtime_error(msg);}
static void sprites(PpuState& p,bool tileOverflow,unsigned y){
 p.forceBlank=false;p.brightness=0;p.tm=0;p.ts=0;
 p.obsel=tileOverflow?0x40:0;
 std::fill(p.oam.begin(),p.oam.end(),0);
 for(unsigned i=0;i<128;i++)p.oam[4*i+1]=128;
 for(unsigned i=0;i<(tileOverflow?5u:33u);i++){
  p.oam[4*i]=16;p.oam[4*i+1]=(std::uint8_t)y;
  if(tileOverflow)p.oam[512+(i>>2)]|=(std::uint8_t)(2u<<((i&3u)*2u));
 }
}
static std::unique_ptr<SnesRuntime> live(bool time,unsigned y=41){
 auto h=std::make_unique<SnesRuntime>();h->headless=true;
 sprites(h->ppu,time,y);h->beginFrame();h->currentScanline=40;
 h->setMasterCycle(0);h->wramRefreshAppliedThisLine=true;
 h->hdmaExecutedThisLine=true;
 return h;
}
int main(){try{
 unsigned cases=0;
 // The raster renderer must not set next-line status simply by painting pixels.
 for(bool time:{false,true}){
  auto h=live(time);
  h->renderVisibleUntilMasterCycle(40,200);
  check((h->ppu.read(0x213e)&0xc0u)==0,"raster rendering leaked OBJ flags before evaluation");cases++;
 }
 // 33rd matching OBJ is tested at H=65 (4 master clocks per H dot).
 for(unsigned first:{0u,1u,31u,64u,127u}){
  auto h=live(false);h->ppu.regs[3]=0x80;h->ppu.oamAddr=(std::uint16_t)(first*2u);
  for(unsigned i=0;i<128;i++)h->ppu.oam[4*i+1]=41; // all rotations overflow at 33rd evaluation
  h->advanceCpuMasterCycles(259);
  check((h->ppu.read(0x213e)&0x40u)==0,"Range Over arrived before 33rd OBJ evaluation");cases++;
  h->advanceCpuMasterCycles(1);
  check((h->ppu.read(0x213e)&0x40u)!=0,"33rd OBJ did not set Range Over");cases++;
  h->advanceCpuMasterCycles(200);
  check((h->ppu.read(0x213e)&0x40u)!=0,"Range Over not sticky");cases++;
 }
 // Evaluation targets the NEXT line, not the line being painted.
 {
  auto h=live(false,33);h->advanceCpuMasterCycles(360);
  check((h->ppu.read(0x213e)&0xc0u)==0,"current-line OBJ incorrectly set status");cases++;
 }
 // Time Over is committed only at completion of the HBlank fetch window.
 for(bool brightnessZero:{false,true}){
  auto h=live(true);h->ppu.brightness=brightnessZero?0:15;
  h->advanceCpuMasterCycles(1359);
  check((h->ppu.read(0x213e)&0xc0u)==0,"Time Over arrived before HBlank tile fetch completed");cases++;
  h->advanceCpuMasterCycles(1);
  check((h->ppu.read(0x213e)&0xc0u)==0x80u,"Time Over missing after tile fetch");cases++;
  h->advanceCpuMasterCycles(4);
  check((h->ppu.read(0x213e)&0x80u)!=0,"Time Over did not persist to next scanline");cases++;
 }
 // Exactly 32 in-range sprites and 32 slivers must not set overflow bits.
 {
  auto h=live(false);h->ppu.oam[4*32+1]=128;
  h->advanceCpuMasterCycles(1360);
  check((h->ppu.read(0x213e)&0xc0u)==0,"false Range Over at 32 sprites");cases++;
 }
 {
  auto h=live(true);h->ppu.oam[4*4+1]=128;
  h->advanceCpuMasterCycles(1360);
  check((h->ppu.read(0x213e)&0xc0u)==0,"false Time Over at 32 slivers");cases++;
 }
 // Forced blank must not evaluate OBJ. Turning it off resumes evaluation.
 {
  auto h=live(false);
  for(unsigned i=0;i<128;i++)h->ppu.oam[4*i+1]=41;
  h->ppu.forceBlank=true;
  h->advanceCpuMasterCycles(260);
  check((h->ppu.read(0x213e)&0x40u)==0,"forced blank generated Range Over");cases++;
  h->ppu.forceBlank=false;
  h->advanceCpuMasterCycles(4);
  check((h->ppu.read(0x213e)&0x40u)==0,"forced blank replayed skipped sprite evaluations");cases++;
  h->advanceCpuMasterCycles(264);
  check((h->ppu.read(0x213e)&0x40u)!=0,"OBJ evaluation did not resume for later sprites");cases++;
 }
 // Mid-line forced blank drops OBJ selection permanently for that line;
 // tile fetch must use the selected subset, not rescan the whole OAM.
 {
  auto h=live(true);h->ppu.forceBlank=true;
  h->advanceCpuMasterCycles(20);
  h->ppu.forceBlank=false;
  h->advanceCpuMasterCycles(1340);
  check((h->ppu.read(0x213e)&0xc0u)==0,"HBlank fetch reselected forced-blanked sprites");cases++;
 }
 // Standalone renderer retains its historical eager scanline status path.
 {
  PpuState p;sprites(p,false,40);std::vector<std::uint32_t> frame;
  p.renderScanline(frame,40);check((p.read(0x213e)&0x40u)!=0,"standalone render lost overflow status");cases++;
 }
 // A new frame clears sticky flags and resets the timing cursor.
 {
  auto h=live(false);h->advanceCpuMasterCycles(260);
  check((h->ppu.objRangeTimeFlags&0x40u)!=0,"setup missing Range Over");
  h->beginFrame();check(h->ppu.objRangeTimeFlags==0,"frame boundary did not reset OBJ state");cases++;
 }
 std::cout<<"PPU_OBJ_NEXT_SCANLINE_TIMING_V043668_PASS cases="<<cases<<"\n";
}catch(const std::exception&e){std::cerr<<"PPU_OBJ_NEXT_SCANLINE_TIMING_V043668_FAIL "<<e.what()<<"\n";return 1;}}
