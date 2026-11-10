// SNES OBJ hardware-limit regression, based on public SNESdev sprite rules.
// Expectations below are derived from the specification, not by comparing
// two Forja renderers to one another. No real-hardware execution is claimed.
#include "runtime.hpp"
#include <algorithm>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>

static unsigned checks=0;
static void need(bool pass,const char*msg){if(!pass)throw std::runtime_error(msg);++checks;}
static PpuState blank(unsigned obsel=0){
 PpuState p; p.obsel=(std::uint8_t)obsel;p.forceBlank=false;p.brightness=15;
 p.tm=0x10;p.ts=0;std::fill(p.oam.begin(),p.oam.end(),0);
 std::fill(p.vram.begin(),p.vram.end(),0);
 for(unsigned i=0;i<128;++i)p.oam[i*4+1]=200;
 p.vram[0]=0xff; p.cgram[258]=31; // fully opaque 8-pixel row in tile 0
 return p;
}
static void sprite(PpuState&p,unsigned i,int x,int y,bool large=false,unsigned attr=0){
 const unsigned raw=(unsigned)(x<0?x+512:x)&511u,base=i*4;
 p.oam[base]=(std::uint8_t)raw;p.oam[base+1]=(std::uint8_t)y;
 p.oam[base+2]=0;p.oam[base+3]=(std::uint8_t)attr;
 const unsigned shift=(i&3u)*2u,position=512u+i/4u;
 p.oam[position]=(std::uint8_t)((p.oam[position]&~(3u<<shift))|
   (((raw>>8u)|((unsigned)large<<1u))<<shift));
}
int main(){try{
 // Range: 32 sprites maximum; selected in OAM order, whether hidden by
 // overlap or disabled TM. X=-256 consumes one slot despite being invisible.
 {
  auto p=blank();sprite(p,0,-256,40);
  for(unsigned i=1;i<=32;i++)sprite(p,i,16,40);
  const auto e=p.evaluateSpriteSlivers(40);
  need(e.rangeOver,"33rd sprite did not set Range Over");
  need(!e.timeOver,"33 8x8 sprites should not trigger Time Over");
  need(e.count==32,"X=-256 did not use exactly one sprite slot");
  need(e.slivers[0].index==31,"highest indexed accepted sprite not last in reverse fetch");
  need(std::none_of(e.slivers.begin(),e.slivers.begin()+e.count,[](auto&s){return s.index==32;}),
      "33rd sprite survived the 32-sprite limit");
  const auto row=p.buildSpriteRow(40);
  need(!row[0].valid,"X=-256 painted at screen X=0");
  need(row[16].valid,"visible sprite disappeared after invisible X=-256 sprite");
  need((p.read(0x213e)&0xc0)==0x40,"STAT77 Range Over incorrect");
  need((p.read(0x213e)&0xc0)==0x40,"reading STAT77 cleared the sticky flag");
 }
 {
  auto p=blank();sprite(p,0,-255,40); // entirely offscreen for 8x8
  for(unsigned i=1;i<=32;i++)sprite(p,i,16,40);
  const auto e=p.evaluateSpriteSlivers(40);
  need(!e.rangeOver,"ordinary offscreen sprite used up a range slot");
  need(e.count==32,"ordinary offscreen sprite used up a sliver slot");
  need(e.slivers[0].index==32,"32nd onscreen sprite should be kept");
 }
 // Visibility boundaries: -8 excluded, -7 included, 255 included, -256
 // included for evaluation but never painted.
 for(const int x:{-8,-7,255,-256}){
  auto p=blank();sprite(p,0,x,40);
  const auto e=p.evaluateSpriteSlivers(40);
  const bool inRange=x!=-8;
  need(e.count==(inRange?1u:0u),"incorrect OBJ X-boundary inclusion");
  const auto row=p.buildSpriteRow(40);
  need(row[0].valid==(x==-7),"negative clipped OBJ did not paint correct pixels");
  need(row[255].valid==(x==255),"right-edge OBJ did not paint correct pixels");
 }
 // Time: process 34 8-pixel slivers in REVERSE OAM order; when full,
 // the lowest OAM-index sprite loses its rightmost tiles first.
 {
  auto p=blank(2u<<5u); // size mode 2: 8x8 / 64x64
  for(unsigned i=0;i<5;i++)sprite(p,i,16,40,true);
  const auto e=p.evaluateSpriteSlivers(40);
  need(!e.rangeOver,"five large sprites unexpectedly overflowed 32 OBJ limit");
  need(e.timeOver,"40 slivers did not trigger Time Over");
  need(e.count==34,"Time Over rendered beyond 34 fetched slivers");
  for(unsigned index=0;index<4;index++){
   unsigned expected=4-index;
   for(unsigned k=0;k<8;k++)need(e.slivers[index*8+k].index==expected,
       "sliver priority fetch did not start at highest OAM index");
  }
  need(e.slivers[32].index==0&&e.slivers[33].index==0,
       "low-index sprite did not retain first two slivers");
  need(e.slivers[32].x==16&&e.slivers[33].x==24,
       "low-index sprite dropped leftmost instead of rightmost slivers");
  need((p.read(0x213e)&0xc0)==0x80,"STAT77 Time Over incorrect");
 }
 // X=-256 must consume ALL of its large-size tile slivers, even though
 // none is painted. That forces earlier sprites to lose their CHR tiles.
 {
  auto p=blank(2u<<5u);
  for(unsigned i=0;i<4;i++)sprite(p,i,16,40,true);
  sprite(p,4,-256,40,true);
  const auto e=p.evaluateSpriteSlivers(40);
  need(e.timeOver&&e.count==34,"X=-256 did not use all 8 time slots");
  for(unsigned i=0;i<8;i++)need(e.slivers[i].index==4,"X=-256 slivers not fetched first");
  const auto row=p.buildSpriteRow(40);
  need(!row[0].valid,"X=-256 large sprite painted despite special status");
  need(row[16].valid,"visible large sprite disappeared");
 }
 // H-flipped sprite still fetches slivers left-to-right in SCREEN order,
 // while its tile numbers reverse.
 {
  auto p=blank(2u<<5u);sprite(p,0,16,40,true,0x40);
  const auto e=p.evaluateSpriteSlivers(40);
  need(e.count==8,"horizontal flip changed 64px tile count");
  for(unsigned i=0;i<8;i++){
   need(e.slivers[i].x==16+(int)i*8,"flipped sliver order not left-to-right");
   need((e.slivers[i].tile&15u)==7-i,"horizontal tile reversal wrong");
  }
 }
 // Runtime: scanline-ahead HBlank scheduling applies the same special
 // case to 32/34 slot counters and keeps STATUS flags sticky through reads.
 {
  auto h=std::make_unique<SnesRuntime>();h->headless=true;h->beginFrame();
  auto&p=h->ppu;p=blank(2u<<5u);p.deferObjStatus=true;
  for(unsigned i=0;i<4;i++)sprite(p,i,16,41,true);
  sprite(p,4,-256,41,true);
  h->beginScanline(40);h->wramRefreshAppliedThisLine=true;h->hdmaExecutedThisLine=true;
  h->advanceCpuMasterCycles(1364u);
  need(h->currentScanline==41,"timing scanline rollover failed");
  need(h->objDisplaySliverCount==34,"timed fetch did not obey 34 tile slots");
  need((p.read(0x213e)&0xc0)==0x80,"runtime Time Over flag missing");
  need(h->objDisplaySlivers[0].spriteIndex==4,"runtime reverse fetch order incorrect");
  need(h->objDisplaySlivers[0].screenX==-256,"runtime lost invisible sliver X");
 }
 std::cout<<"PPU_OBJ_HARDWARE_LIMITS_V043679_PASS checks="<<checks<<'\n';
 return 0;
 }catch(const std::exception&e){std::cerr<<"PPU_OBJ_HARDWARE_LIMITS_V043679_FAIL "<<e.what()<<'\n';return 1;}
}
