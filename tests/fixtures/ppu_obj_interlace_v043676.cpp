#include "runtime.hpp"
#include <algorithm>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <vector>
static void ok(bool test,const char*why){if(!test)throw std::runtime_error(why);}
static std::unique_ptr<SnesRuntime> setup(unsigned mode,unsigned screenIlace,unsigned objIlace,unsigned field){
  auto h=std::make_unique<SnesRuntime>();h->headless=true;h->interlaceField=field!=0;h->beginFrame();
  auto&p=h->ppu;p.forceBlank=false;p.tm=0x10;p.ts=0;p.brightness=15;p.bgmode=(std::uint8_t)mode;
  p.setini=(std::uint8_t)(screenIlace|(objIlace<<1u));p.obsel=3u<<5u;
  std::fill(p.oam.begin(),p.oam.end(),0);std::fill(p.vram.begin(),p.vram.end(),0);
  for(unsigned i=0;i<128u;i++){p.oam[4u*i]=16;p.oam[4u*i+1u]=200;}
  p.oam[0]=16;p.oam[1]=40;p.oam[2]=0;p.oam[3]=0;
  for(unsigned i=0;i<256;i++){p.cgram[2*i]=(std::uint8_t)(i*3u+1u);p.cgram[2*i+1]=(std::uint8_t)(i*5u);}
  for(unsigned row=0;row<8u;row++)p.vram[2u*row]=(std::uint8_t)(0x80u>>row);
  h->configureFramebuffer();h->beginScanline(40);h->wramRefreshAppliedThisLine=true;h->hdmaExecutedThisLine=true;
  return h;
}
int main(){try{
 unsigned checks=0;
 for(unsigned mode:{0u,5u,6u})for(unsigned screen:{0u,1u})for(unsigned obj:{0u,1u})for(unsigned field:{0u,1u}){
   auto h=setup(mode,screen,obj,field);auto&p=h->ppu;
   h->advanceCpuMasterCycles(1364u);ok(h->currentScanline==41,"scanline rollover");++checks;
   ok(h->objDisplaySliverLine==41&&h->objDisplaySliverCount==2,"16px sprite fetch/commit");++checks;
   ok(h->hasTimedObjRow(41),"timed OBJ should handle BG5/6 and OBJ interlace independently");++checks;
   unsigned expectedRow=obj?(2u+field):1u;
   ok(h->objDisplaySlivers[0].row==expectedRow,"wrong field-dependent captured CHR row");++checks;
   ok(h->objDisplaySlivers[0].chrPlanes[0]==(0x80u>>expectedRow),"wrong field-dependent CHR byte");++checks;
   std::vector<std::uint32_t> expected;
   p.renderOutputSegment(expected,41,0,p.outputWidth(),field);
   h->finishVisibleLine(41);
   const unsigned scale=(mode==5||mode==6)?2u:1u;
   for(unsigned x=0;x<p.outputWidth();x++){
     const std::uint32_t a=expected[(std::size_t)(screen?82u+field:41u)*p.outputWidth()+x];
     const std::uint32_t b=h->framebuffer[(std::size_t)(screen?82u+field:41u)*h->fbWidth+x];
     ok(a==b,"steady-state compositor differs between timed/static outputs");
   }
   ++checks;
   const unsigned pixelX=(16u+expectedRow)*scale;
   ok(h->framebuffer[(std::size_t)(screen?82u+field:41u)*h->fbWidth+pixelX]==p.rgba15(p.palette15(129)),"OBJ row selected the wrong output pixel");++checks;
   // A post-HBlank modification of OAM/CHR must not change the fetched row.
   auto frozen=setup(mode,screen,obj,field);auto&f=frozen->ppu;frozen->advanceCpuMasterCycles(1364u);
   f.oam[0]=80;std::fill(f.vram.begin(),f.vram.end(),0);
   frozen->finishVisibleLine(41);
   ok(frozen->framebuffer[(std::size_t)(screen?82u+field:41u)*frozen->fbWidth+pixelX]==f.rgba15(f.palette15(129)),"OAM/VRAM mutation rewrote captured sprite");++checks;
 }
 // OBJ interlace must reduce sprite height independently of display interlace.
 for(unsigned obj:{0u,1u})for(unsigned field:{0u,1u}){
  auto h=setup(0,0,obj,field);auto&p=h->ppu;
  ok(p.objInRangeForLine(0,48,obj,field)==(obj?false:true),"interlaced OBJ height is not halved");++checks;
  ok(p.objInRangeForLine(0,40,obj,field),"first scanline of OBJ disappeared");++checks;
  ok(PpuState::objRowOffset(0,255,obj,field)==(obj?2u+field:1u),"Y=255 wrap failed");++checks;
  if(field==0){
    const auto native=p.buildSpriteRow(41);
    const auto explicitRow=p.buildSpriteRow(41,obj,field);
    for(unsigned x=0;x<256u;x++)
      ok(native[x].valid==explicitRow[x].valid&&(!native[x].valid||native[x].c15==explicitRow[x].c15),"implicit static OBJ mode ignored SETINI bit 1");
    ++checks;
  }
 }
 // Divergent field/mode data must never silently reuse stale line data.
 {
  auto h=setup(5,1,1,0);h->advanceCpuMasterCycles(1364);
  ok(h->hasTimedObjRow(41),"valid OBJ buffer missing");++checks;
  h->interlaceField=true;ok(!h->hasTimedObjRow(41),"wrong field reused");++checks;
  h->interlaceField=false;h->ppu.setini=1u;ok(!h->hasTimedObjRow(41),"wrong OBJ interlace flag reused");++checks;
 }
 std::cout<<"PPU_OBJ_INTERLACE_V043676_PASS cases="<<checks<<"\n";
 return 0;
}catch(const std::exception&e){std::cerr<<"PPU_OBJ_INTERLACE_V043676_FAIL "<<e.what()<<"\n";return 1;}}
