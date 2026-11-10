#include "runtime.hpp"
#include <algorithm>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <vector>
static void check(bool test,const char *msg){if(!test)throw std::runtime_error(msg);}
static std::unique_ptr<SnesRuntime> setup(){
  auto h=std::make_unique<SnesRuntime>(); h->headless=true;h->beginFrame();
  auto &p=h->ppu;p.forceBlank=false;p.tm=0x10;p.ts=0;p.brightness=15;p.obsel=0;
  std::fill(p.oam.begin(),p.oam.end(),0);std::fill(p.vram.begin(),p.vram.end(),0);
  for(unsigned i=0;i<128;i++){p.oam[i*4]=16;p.oam[i*4+1]=200;}
  p.oam[0]=16;p.oam[1]=41;
  for(unsigned i=0;i<256;i++){p.cgram[i*2]=(std::uint8_t)(i*7+1);p.cgram[i*2+1]=(std::uint8_t)((i*3)>>3);}
  h->beginScanline(40);h->setMasterCycle(0);
  h->wramRefreshAppliedThisLine=true;h->hdmaExecutedThisLine=true;
  return h;
}
static void toNext(SnesRuntime&h){h.advanceCpuMasterCycles(1364);check(h.currentScanline==41,"rollover");check(h.objDisplaySliverLine==41,"latch line ownership");}
static std::uint32_t pixel(const SnesRuntime&h,unsigned x){return h.framebuffer[41u*h.fbWidth+x];}
int main(){
try{
 unsigned cases=0;
 {
   auto h=setup();auto &p=h->ppu;
   p.vram[0]=0x80;p.vram[1]=0x40;p.vram[16]=0x20;p.vram[17]=0x10;
   toNext(*h);check(h->objDisplaySliverCount==1&&h->hasTimedObjRow(41),"CHR buffer not committed");++cases;
   const auto before=h->objDisplaySlivers[0].chrPlanes;
   check(before[0]==0x80&&before[1]==0x40&&before[2]==0x20&&before[3]==0x10,"all four 4bpp planes were not fetched");++cases;
   p.oam[0]=90; p.oam[3]=0xf1;
   p.vram[0]=p.vram[1]=p.vram[16]=p.vram[17]=0;
   h->finishVisibleLine(41);
   for(unsigned x=0;x<4;x++){
     const unsigned ci=1u<<x;
     check(pixel(*h,16u+x)==p.rgba15(p.palette15(128u+ci)),"post-HBlank VRAM mutation changed fetched CHR pixel");++cases;
   }
   check(pixel(*h,24)==p.rgba15(p.palette15(0)),"fetched CHR generated stray pixel");++cases;
   check(!p.buildSpriteRow(41)[16].valid,"static PPU no longer references current OAM/VRAM");++cases;
   h->objTimedChrEnabled=false;h->rasterCursorX=0;h->finishVisibleLine(41);
   check(pixel(*h,16)==p.rgba15(p.palette15(0)),"v74 live-CHR opt-out failed");++cases;
 }
 {
   // The end of each 8-master-cycle HBlank slot freezes its own CHR bytes.
   auto h=setup();auto&p=h->ppu;p.oam[512]=0x02u; // large OBJ in mode 0 = two 8px slivers
   p.vram[0]=0x80;p.vram[32]=0x80;
   h->advanceCpuMasterCycles(1088);
   check(h->objFetchedSliverCount==0,"sliver fetched before first HBlank slot");++cases;
   h->advanceCpuMasterCycles(8);
   check(h->objFetchedSliverCount==1&&h->objFetchedSlivers[0].chrPlanes[0]==0x80,"first CHR slot fetch timing");++cases;
   p.vram[0]=0;p.vram[32]=0x40;
   h->advanceCpuMasterCycles(8);
   check(h->objFetchedSliverCount==2&&h->objFetchedSlivers[1].chrPlanes[0]==0x40,"second CHR slot did not observe intervening VRAM write");++cases;
   p.vram[32]=0;
   h->advanceCpuMasterCycles(1364-1104);
   check(h->objDisplaySliverCount==2,"two slivers lost on commit");++cases;
   h->finishVisibleLine(41);
   check(pixel(*h,16)==p.rgba15(p.palette15(129)),"first CHR slot retroactively mutated");++cases;
   check(pixel(*h,24)==p.rgba15(p.palette15(0)),"second sliver bit 7 incorrectly set");++cases;
   check(pixel(*h,25)==p.rgba15(p.palette15(129)),"second sliver late VRAM byte ignored");++cases;
 }
 {
   // Palette writes should still affect only unpainted output segments.
   auto h=setup();auto&p=h->ppu;
   p.vram[0]=0x80;p.vram[1]=0x40;
   toNext(*h);
   const auto old129=p.palette15(129),old130=p.palette15(130);
   h->renderVisibleUntilMasterCycle(41,14+4*17); // pixel x16 committed, x17 pending
   check(pixel(*h,16)==p.rgba15(old129),"first raster segment did not paint fetched CHR");++cases;
   p.cgram[260]=0x1f;p.cgram[261]=0;
   check(p.palette15(130)!=old130,"palette test precondition");++cases;
   p.vram[0]=p.vram[1]=0;h->finishVisibleLine(41);
   check(pixel(*h,16)==p.rgba15(old129),"palette write damaged earlier pixel");++cases;
   check(pixel(*h,17)==p.rgba15(p.palette15(130)),"CGRAM live-segment rendering was lost");++cases;
 }
 {
   // Maximum OBJ VRAM address: ensure four CHR planes index correctly near 64K end.
   auto h=setup();auto&p=h->ppu;
   p.obsel=7;p.oam[1]=34;p.oam[2]=255;p.oam[3]=1;
   p.vram[0xffee]=0x80;p.vram[0xffef]=0x40;
   p.vram[0xfffe]=0x20;p.vram[0xffff]=0x10;
   toNext(*h);
   check(h->objDisplaySliverCount==1&&h->objDisplaySlivers[0].vramAddress==0xffee,"OBJ CHR bank/row address overflow");++cases;
   const auto planes=h->objDisplaySlivers[0].chrPlanes;
   check(planes[0]==0x80&&planes[1]==0x40&&planes[2]==0x20&&planes[3]==0x10,"CHR high VRAM address was not read");++cases;
   p.vram[0xffee]=p.vram[0xffef]=p.vram[0xfffe]=p.vram[0xffff]=0;
   h->finishVisibleLine(41);
   for(unsigned x=0;x<4;x++){
     check(pixel(*h,16+x)==p.rgba15(p.palette15(128u+(1u<<x))),"high VRAM address CHR latch lost");++cases;
   }
 }
 {
   // Sprite mirroring acts on the fetched bitplanes (not a second VRAM read).
   for(unsigned flip=0;flip<4;flip++){
     auto h=setup();auto&p=h->ppu;
     p.oam[1]=40;p.oam[3]=(std::uint8_t)((flip&1?0x40:0)|(flip&2?0x80:0));
     const unsigned y=(flip&2)?6:1;
     p.vram[y*2]=0x80;
     toNext(*h);
     p.vram[y*2]=0;
     h->finishVisibleLine(41);
     check(pixel(*h,(flip&1)?23:16)==p.rgba15(p.palette15(129)),"flip changed captured row or pixel bit");++cases;
     check(pixel(*h,(flip&1)?16:23)==p.rgba15(p.palette15(0)),"flip leaked pixels");++cases;
   }
 }
 {
   auto h=setup();auto&p=h->ppu;p.vram[0]=0x80;
   p.forceBlank=true;toNext(*h);
   check(h->objDisplaySliverCount==0,"blanked HBlank fetched unexpected CHR");++cases;
   p.forceBlank=false;h->finishVisibleLine(41);
   check(pixel(*h,16)==p.rgba15(p.palette15(0)),"blank commit reopened OAM fetch");++cases;
 }
 {
   // Static/old renderer fallback is retained for high-res interlace modes.
   for(unsigned mode=5;mode<=6;mode++){
     auto h=setup();auto&p=h->ppu;
     p.bgmode=(std::uint8_t)mode;p.setini=1u;
     toNext(*h);
     check(!h->hasTimedObjRow(41),"interlace mode unexpectedly opted into coarse CHR latch");++cases;
   }
 }
 // Compare with v74's reference output when VRAM/OAM never change after fetch.
 // This is a synthetic internal regression oracle, not original SNES hardware.
 for(unsigned mode=0;mode<8;mode++)for(unsigned seed=0;seed<8;seed++){
   auto h=setup();auto&p=h->ppu;
   p.obsel=(std::uint8_t)((mode<<5u)|((seed*3u)&31u));
   for(unsigned i=0;i<6;i++){
     p.oam[4*i]=(std::uint8_t)(12+i*29);
     p.oam[4*i+1]=(std::uint8_t)(37+i%4);
     p.oam[4*i+2]=(std::uint8_t)(seed*19+i*41);
     p.oam[4*i+3]=(std::uint8_t)(seed*37+i*59);
     if((i+seed)&1)p.oam[512u+i/4u]|=(std::uint8_t)(2u<<((i&3u)*2u));
   }
   for(unsigned i=0;i<65536;i++)p.vram[i]=(std::uint8_t)((i*13u+seed*7u+0x55u)&255u);
   toNext(*h);
   std::vector<std::uint32_t> expected;
   p.renderOutputSegment(expected,41,0,256);
   h->finishVisibleLine(41);
   for(unsigned x=0;x<256;x++)
     check(pixel(*h,x)==expected[41u*256u+x],"steady VRAM differs from static compositor");
   ++cases;
 }
 std::cout<<"PPU_OBJ_CHR_LATCH_V043675_PASS cases="<<cases<<"\n";
 return 0;
}catch(const std::exception&e){std::cerr<<"PPU_OBJ_CHR_LATCH_V043675_FAIL "<<e.what()<<"\n";return 1;}
}
