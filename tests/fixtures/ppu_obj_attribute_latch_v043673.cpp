#include "runtime.hpp"
#include <algorithm>
#include <iostream>
#include <memory>
#include <stdexcept>
static void need(bool q,const char*msg){if(!q)throw std::runtime_error(msg);}
static std::unique_ptr<SnesRuntime> make(unsigned count=2){
  auto h=std::make_unique<SnesRuntime>();h->headless=true;h->beginFrame();
  auto&p=h->ppu;p.forceBlank=false;p.tm=0;p.ts=0;p.brightness=15;p.obsel=0;
  std::fill(p.oam.begin(),p.oam.end(),0);
  for(unsigned i=0;i<128;i++){p.oam[i*4]=16;p.oam[i*4+1]=200;}
  for(unsigned i=0;i<count;i++){p.oam[i*4]=16;p.oam[i*4+1]=41;}
  h->beginScanline(40);h->setMasterCycle(0);
  h->wramRefreshAppliedThisLine=true;h->hdmaExecutedThisLine=true;
  return h;
}
int main(){try{
  unsigned cases=0;
  // H272 position is latched, but attributes remain live until first CHR slot.
  {
    auto h=make();h->advanceCpuMasterCycles(1088);
    need(h->objFetchSpriteLoaded&&!h->objFetchSpriteAttributesLoaded,"early attribute latch at position boundary");++cases;
    need(h->objFetchedSliverCount==0,"premature sliver record");++cases;
    h->ppu.oam[7]=0x3Au;h->ppu.oam[6]=0x24u;
    h->advanceCpuMasterCycles(8);
    need(h->objFetchedSliverCount==1&&h->objFetchedSlivers[0].priority==16u,"attribute not captured on first CHR slot");++cases;
    need(h->objFetchedSliverCount==1&&h->objFetchedSlivers[0].spriteIndex==1,"wrong selected OBJ order");++cases;
    const auto &s=h->objFetchedSlivers[0];
    need(s.palette==5u&&s.priority==16u&&!s.hflip&&!s.vflip,"captured palette/priority/flip flags wrong");++cases;
    need(s.tile==0x24u&&s.row==0u&&s.vramAddress==0x480u,"CHR tile address not captured");++cases;
  }
  // Sprite #0 position is captured on #1 completion; its attribute is still
  // read at the next CHR slot boundary, not at #1's completion.
  {
    auto h=make();h->advanceCpuMasterCycles(1096);
    need(h->objFetchSpriteLoaded&&!h->objFetchSpriteAttributesLoaded&&h->objFetchSpriteIndex==0,"position/attribute latch stages collapsed");++cases;
    h->ppu.oam[3]=0x72u;h->ppu.oam[2]=0x01u;
    h->advanceCpuMasterCycles(8);
    need(h->objFetchedSliverCount==2&&h->objFetchedSlivers[1].spriteIndex==0,"next sprite missing from CHR records");++cases;
    const auto&s=h->objFetchedSlivers[1];
    need(s.priority==16u&&s.palette==1u&&s.hflip&&!s.vflip,"next sprite attributes not sampled at its first CHR slot");++cases;
    need(s.tile==1u&&s.vramAddress==0x20u,"next sprite tile address wrong");++cases;
  }
  // Wider sprite attributes must remain stable after first tile.
  {
    auto h=make(1);h->ppu.obsel=0x00;h->ppu.oam[512]=2u; // OBJ #0 large 16x16
    h->ppu.oam[2]=0x2fu;h->ppu.oam[3]=0xE8u;
    h->advanceCpuMasterCycles(1096);
    need(h->objFetchedSliverCount==1&&h->objFetchedSlivers[0].vflip,"first sliver attr missing");++cases;
    auto first=h->objFetchedSlivers[0];
    h->ppu.oam[2]=0x40u;h->ppu.oam[3]=0x10u;h->ppu.oam[1]=55u;h->ppu.obsel=0x03u;
    h->advanceCpuMasterCycles(8);
    need(h->objFetchedSliverCount==2u,"second sliver missing");++cases;
    const auto &second=h->objFetchedSlivers[1];
    need(second.palette==first.palette&&second.priority==first.priority&&second.vflip==first.vflip,"latched metadata changed mid-sprite");++cases;
    need(second.tile==0x3Fu&&first.tile==0x30u,"hflip / Y row generated incorrect CHR indices");++cases;
    need(second.vramAddress==((second.tile&255u)*32u+((15u&7u)*2u)),"name base / Y changed after attribute latch");++cases;
  }
  // New OBJ samples its own attribute rather than inheriting the prior sprite.
  {
    auto h=make();h->ppu.oam[7]=0x30u;h->ppu.oam[3]=0x0Eu;
    h->advanceCpuMasterCycles(1104);
    need(h->objFetchedSliverCount==2&&h->objFetchedSlivers[0].priority==16u&&h->objFetchedSlivers[1].priority==4u,"cross-sprite attribute leakage");++cases;
    need(h->objFetchedSlivers[1].palette==7u,"next sprite palette incorrect");++cases;
  }
  // Nine-bit name selector and OBSEL name-gap must be included in VRAM base.
  {
    auto h=make(1);h->ppu.obsel=0x1Bu; // base 3, name-gap selector 3
    h->ppu.oam[2]=0x05u;h->ppu.oam[3]=0x01u;
    h->advanceCpuMasterCycles(1096);
    const auto &s=h->objFetchedSlivers[0];
    const unsigned expected=((3u<<14)+(4u<<13)+(5u*32u))&0xFFFFu;
    need(s.tile==0x105u&&s.vramAddress==expected,"OBJ name-select VRAM address wrong");++cases;
  }
  // Vertical flip uses the height, including non-square 16x32 modes.
  {
    auto h=make(1);h->ppu.obsel=0xC0u; // 16x32 small
    h->ppu.oam[1]=40u;h->ppu.oam[3]=0x80u;
    h->advanceCpuMasterCycles(1096);
    const auto&s=h->objFetchedSlivers[0];
    need(s.vflip&&s.row==6u&&s.tile==0x30u,"vflip rectangular row/tile incorrect");++cases;
    need(s.vramAddress==0x60Cu,"vflip CHR address incorrect");++cases;
  }
  // Entry timing must be deterministic for coarse one-cycle vs one-batch updates.
  {
    auto a=make(),b=make();a->ppu.oam[7]=0x52u;b->ppu.oam[7]=0x52u;
    a->advanceCpuMasterCycles(1104);
    for(unsigned i=0;i<1104;i++)b->advanceCpuMasterCycles(1);
    need(a->objFetchedSliverCount==b->objFetchedSliverCount,"chunk-dependent fetched count");++cases;
    for(unsigned i=0;i<a->objFetchedSliverCount;i++){
      const auto&x=a->objFetchedSlivers[i];const auto&y=b->objFetchedSlivers[i];
      need(x.tile==y.tile&&x.vramAddress==y.vramAddress&&x.priority==y.priority&&x.palette==y.palette,"chunk-dependent attribute record");
    }++cases;
  }
  // Forced blank prevents new CHR fetches, including metadata records.
  {
    auto h=make();h->ppu.forceBlank=true;h->advanceCpuMasterCycles(1104);
    need(h->objFetchedSliverCount==0&&!h->objFetchSpriteAttributesLoaded,"forced blank latched hidden attributes");++cases;
  }
  // Every scanline/frame clears the staging buffer and attribute state.
  {
    auto h=make();h->advanceCpuMasterCycles(1096);h->beginScanline(41);
    need(!h->objFetchSpriteAttributesLoaded&&!h->objFetchSpriteLoaded&&h->objFetchedSliverCount==0,"new line inherited metadata");++cases;
    h->advanceCpuMasterCycles(1096);h->beginFrame();
    need(!h->objFetchSpriteAttributesLoaded&&h->objFetchedSliverCount==0,"new frame inherited metadata");++cases;
  }
  // A 64px-wide sprite is limited to 34 staged slivers and raises Time Over.
  {
    auto h=make(5);h->ppu.obsel=0x40u;
    for(unsigned i=0;i<5;i++)h->ppu.oam[512u+i/4u]|=(std::uint8_t)(2u<<((i&3u)*2u));
    h->advanceCpuMasterCycles(1360);
    need(h->objFetchedSliverCount==34u&&h->objFetchSlivers==34u,"CHR fetch exceeded 34 slots");++cases;
    need((h->ppu.objRangeTimeFlags&0x80u)!=0,"time over flag lost");++cases;
  }
  // At a natural scanline rollover, keep the next-line CHR metadata alive.
  {
    auto h=make();h->advanceCpuMasterCycles(1364);
    need(h->currentScanline==41&&h->objFetchedSliverCount==0,"scanline did not roll or stage did not clear");
    need(h->objDisplaySliverLine==41&&h->objDisplaySliverCount==2,"next-line OBJ buffer not committed");
    need(h->objDisplaySlivers[0].spriteIndex==1&&h->objDisplaySlivers[1].spriteIndex==0,"committed sprite order incorrect");++cases;
  }
  // Differential oracle against the existing eager OBJ compositor on static
  // OAM: varying all eight size modes, ninth name bit, priority, palette,
  // flips and OBSEL pages must yield the same 34-slot tile metadata.
  for(unsigned mode=0;mode<8;mode++)for(unsigned seed=0;seed<8;seed++){
    auto h=make(6);auto&p=h->ppu;
    p.obsel=(std::uint8_t)((mode<<5u)|((seed*3u)&31u));
    for(unsigned i=0;i<6;i++){
      const unsigned o=i*4u;
      p.oam[o]=(std::uint8_t)(12u+i*29u);
      p.oam[o+1u]=(std::uint8_t)(37u+(i%4u));
      p.oam[o+2u]=(std::uint8_t)((seed*19u+i*41u)&255u);
      p.oam[o+3u]=(std::uint8_t)((seed*37u+i*59u)&255u);
      if((i+seed)&1u)p.oam[512u+i/4u]|=(std::uint8_t)(2u<<((i&3u)*2u));
    }
    h->advanceCpuMasterCycles(1360);
    const auto expected=p.evaluateSpriteSlivers(41);
    need(h->objFetchedSliverCount==expected.count,"static OAM tile count disagrees with existing compositor");
    for(unsigned i=0;i<expected.count;i++){
      const auto&got=h->objFetchedSlivers[i];const auto&ref=expected.slivers[i];
      const unsigned address=(p.objNameBase(ref.tile)+(ref.tile&255u)*32u+ref.y*2u)&65535u;
      need(got.spriteIndex==ref.index&&got.screenX==ref.x&&got.tile==ref.tile&&got.row==ref.y,"tile metadata differs from compositor");
      need(got.vramAddress==address&&got.palette==ref.palette&&got.priority==ref.priority&&got.hflip==ref.hflip,"CHR address or OBJ attributes differ from compositor");
    }
    ++cases;
  }
  std::cout<<"PPU_OBJ_ATTRIBUTE_LATCH_V043673_PASS cases="<<cases<<"\n";return 0;
 }catch(const std::exception&e){std::cerr<<"PPU_OBJ_ATTRIBUTE_LATCH_V043673_FAIL "<<e.what()<<"\n";return 1;}
}
