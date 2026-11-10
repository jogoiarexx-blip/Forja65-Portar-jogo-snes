#include "runtime.hpp"
#include <algorithm>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <vector>
static void need(bool ok,const char*why){if(!ok)throw std::runtime_error(why);}
static std::unique_ptr<SnesRuntime> make(unsigned count=1){
  auto h=std::make_unique<SnesRuntime>();h->headless=true;h->beginFrame();
  auto&p=h->ppu;p.forceBlank=false;p.tm=0x10;p.ts=0;p.brightness=15;p.obsel=0;
  std::fill(p.oam.begin(),p.oam.end(),0);
  for(unsigned i=0;i<128;i++){p.oam[i*4]=16;p.oam[i*4+1]=200;}
  for(unsigned i=0;i<count;i++){p.oam[i*4]=16;p.oam[i*4+1]=41;}
  for(unsigned i=0;i<256;i++){p.cgram[i*2]=(std::uint8_t)i;p.cgram[i*2+1]=(std::uint8_t)((i>>3)&0x7F);}
  h->beginScanline(40);h->setMasterCycle(0);
  h->wramRefreshAppliedThisLine=true;h->hdmaExecutedThisLine=true;
  return h;
}
static void rollover(SnesRuntime&h){
  h.advanceCpuMasterCycles(1364);
  need(h.currentScanline==41,"scanline commit timing");
  need(h.objDisplaySliverLine==41,"display buffer line ownership");
}
static std::uint32_t pixel(const SnesRuntime&h,unsigned x){return h.framebuffer[41u*h.fbWidth+x];}
int main(){try{
  unsigned cases=0;
  {
    auto h=make();auto&p=h->ppu;p.vram[0]=0x80;p.cgram[258]=31;p.cgram[259]=0;
    rollover(*h);need(h->hasTimedObjRow(41)&&h->objDisplaySliverCount==1,"timed row unavailable");++cases;
    p.oam[0]=40; p.oam[2]=5; p.oam[3]=0x3A;
    h->finishVisibleLine(41);
    need(pixel(*h,16)==p.rgba15(31)&&pixel(*h,40)==p.rgba15(p.palette15(0)),"OAM move / attribute write modified committed sprite row");++cases;
    // Standalone snapshot rendering deliberately remains live-OAM.
    auto reference=p.buildSpriteRow(41);
    need(!reference[16].valid,"static PpuState sprite compositor no longer reads OAM");++cases;
    h->objTimedRasterEnabled=false;h->rasterCursorX=0;h->finishVisibleLine(41);
    need(pixel(*h,16)==p.rgba15(p.palette15(0)),"legacy opt-out must read current OAM");++cases;
  }
  {
    auto h=make();auto&p=h->ppu;p.vram[0]=0xff;p.cgram[258]=31;p.cgram[259]=0;
    rollover(*h);
    h->renderVisibleUntilMasterCycle(41,14+4*20); // commit x=0..19
    need(pixel(*h,19)==p.rgba15(31),"early segment did not use timed row");++cases;
    p.oam[0]=80; p.vram[0]=0; // committed sprite remains x=16; CHR bytes are segment-live
    h->finishVisibleLine(41);
    need(pixel(*h,19)==p.rgba15(31)&&pixel(*h,20)==p.rgba15(p.palette15(0)),"raster segment leaked later VRAM mutation backwards");++cases;
    need(pixel(*h,80)==p.rgba15(p.palette15(0)),"later segment reread mutated OAM position");++cases;
  }
  {
    auto h=make();auto&p=h->ppu;p.vram[0]=0x80;
    p.forceBlank=true;rollover(*h);
    need(h->hasTimedObjRow(41)&&h->objDisplaySliverCount==0,"forced blank must commit an empty row");++cases;
    p.forceBlank=false;h->finishVisibleLine(41);
    need(pixel(*h,16)==p.rgba15(p.palette15(0)),"blanked HBlank incorrectly refetched OBJ when video resumed");++cases;
    h->beginScanline(41);need(!h->hasTimedObjRow(41),"explicit line reset kept stale timed OBJ buffer");++cases;
    h->rasterCursorX=0;h->finishVisibleLine(41);
    need(pixel(*h,16)!=p.rgba15(p.palette15(0)),"missing timed buffer did not fall back to snapshot compositor");++cases;
    h->beginFrame();need(!h->hasTimedObjRow(41),"frame reset kept timed OBJ");++cases;
  }
  {
    auto h=make(2);auto&p=h->ppu;
    p.oam[0]=16;p.oam[4]=16;p.oam[3]=0x00;p.oam[7]=0x30;
    p.vram[0]=0x80;p.cgram[258]=31;p.cgram[259]=0;
    rollover(*h);h->finishVisibleLine(41);
    const auto snapshot=p.buildSpriteRow(41);
    need(snapshot[16].valid&&snapshot[16].oamIndex==0,"bad reference OAM overlap");++cases;
    need(pixel(*h,16)==p.rgba15(snapshot[16].c15),"overlap ordering changed");++cases;
  }
  // High-res interlace mode 5/6 uses a doubled sprite source Y that has
  // not yet been captured by the coarse undoubled HBlank metadata buffer.
  for(unsigned mode=5;mode<=6;mode++){
    auto h=make();auto&p=h->ppu;
    p.bgmode=(std::uint8_t)mode;p.setini=0x01;
    rollover(*h);
    need(!h->hasTimedObjRow(41),"high-res interlace must keep legacy OBJ path");++cases;
  }
  // Pseudo hires uses a 512-pixel output with the OBJ row sampled at x/2.
  {
    auto h=make();auto&p=h->ppu;p.setini=0x08;p.vram[0]=0xff;
    h->configureFramebuffer();rollover(*h);h->finishVisibleLine(41);
    need(h->fbWidth==512&&h->hasTimedObjRow(41),"pseudo hires 512px path did not select timed row");++cases;
    const unsigned expected=p.rgba15(p.palette15(129));
    need(h->framebuffer[41u*512u+33u]==expected,"pseudo hires odd output pixel lost OBJ");++cases;
  }
  // Oracle: on stable OAM, the *real live raster path* must be bit-identical
  // to the independent PpuState static framebuffer on a varied OBJ matrix.
  for(unsigned mode=0;mode<8;mode++)for(unsigned seed=0;seed<8;seed++){
    auto h=make(6);auto&p=h->ppu;
    p.obsel=(std::uint8_t)((mode<<5u)|((seed*3u)&31u));
    p.ts=(seed&1)?0x10:0;
    p.cgadsub=(seed&2)?0x10:0;
    if(seed&4)p.tmw=0x10;
    p.wh[0]=48;p.wh[1]=80;p.wobjsel=2;
    for(unsigned i=0;i<6;i++){
      const unsigned o=i*4u;
      p.oam[o]=(std::uint8_t)(12u+i*29u);
      p.oam[o+1u]=(std::uint8_t)(37u+(i%4u));
      p.oam[o+2u]=(std::uint8_t)((seed*19u+i*41u)&255u);
      p.oam[o+3u]=(std::uint8_t)((seed*37u+i*59u)&255u);
      if((i+seed)&1u)p.oam[512u+i/4u]|=(std::uint8_t)(2u<<((i&3u)*2u));
    }
    for(unsigned i=0;i<65536;i++)p.vram[i]=(std::uint8_t)((i*13u+seed*7u+0x55u)&255u);
    rollover(*h);
    need(h->hasTimedObjRow(41),"static oracle missing timed stage");
    std::vector<std::uint32_t> expected;
    p.renderOutputSegment(expected,41,0,256);
    h->finishVisibleLine(41);
    for(unsigned x=0;x<256;x++)
      need(pixel(*h,x)==expected[41u*256+x],"timed live raster differs from legacy pixel compositor on stationary OAM");
    ++cases;
  }
  std::cout<<"PPU_OBJ_TIMED_RASTER_V043674_PASS cases="<<cases<<"\n";
  return 0;
 }catch(const std::exception&e){std::cerr<<"PPU_OBJ_TIMED_RASTER_V043674_FAIL "<<e.what()<<"\n";return 1;}
}
