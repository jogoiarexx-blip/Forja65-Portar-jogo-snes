#include <cassert>
#include <iostream>
#include <cstdint>
#include <vector>

static void ensure(bool v,const char* msg){if(!v)throw std::runtime_error(msg);}
static void opaqueSprite(PpuState& p,unsigned i,unsigned x,unsigned y,unsigned at=0){
  unsigned o=i*4u;p.oam[o]=(std::uint8_t)x;p.oam[o+1]=(std::uint8_t)y;p.oam[o+2]=0;p.oam[o+3]=(std::uint8_t)at;
  p.oam[512+(i>>2)] &= (std::uint8_t)~(3u<<((i&3)*2));
}
int main(){try{
  // Separate Mode7 latches: writes to BG1 scroll and matrix must not leak into each other.
  PpuState p;p.bgmode=7;p.tm=1;p.brightness=15;
  p.write(0x211B,0x06);p.write(0x210D,0x0B);
  ensure(p.m7Hofs==0x0B06u && p.scrollX[0]==0x0B00u,"Mode7/scroll latch independent");
  p.write(0x210F,0x22);p.write(0x210E,0x11);
  ensure(p.m7Vofs==0x110Bu,"BG2 scroll should not perturb M7 shared byte latch");
  // The SNES 5-bit brightness LUT must preserve prior integer color arithmetic.
  for(unsigned br=0;br<16;br++){
    p.brightness=(std::uint8_t)br;
    for(unsigned k=0;k<32768;k+=29){auto rgb=p.rgba15((std::uint16_t)k);
      // REV143 (REV138 reintegrado): brilho mestre no dominio de 5 bits, round(c*br/15), depois 5->8 bits.
      auto q=[&](unsigned v){return ((v*br*2u+15u)/30u)*255u/31u;};
      unsigned r=q(k&31u),g=q((k>>5)&31u),b=q((k>>10)&31u);
      ensure(rgb==(0xff000000u|(r<<16)|(g<<8)|b),"RGB555 brightness parity");
    }
  }
  // The high-level PPU must count at most 32 OBJ per scanline and latch STAT77.
  PpuState range;range.obsel=0;
  for(unsigned i=0;i<128;i++)range.oam[i*4+1]=128;
  for(unsigned i=0;i<33;i++)opaqueSprite(range,i,20,40);
  auto re=range.evaluateSpriteSlivers(40);
  ensure(re.rangeOver && !re.timeOver && re.count==32,"32 sprite range quota");
  ensure((range.read(0x213E)&0x40)!=0,"STAT77 range-over latch");
  // 5 large (64x64) sprites each request 8 tiles, exceeding 34 tile slivers.
  PpuState quota;quota.obsel=0x40;
  for(unsigned i=0;i<128;i++)quota.oam[i*4+1]=128;
  for(unsigned i=0;i<5;i++){
    opaqueSprite(quota,i,0,40);
    quota.oam[512+(i>>2)]|=(std::uint8_t)(2u<<((i&3u)*2u));
  }
  auto te=quota.evaluateSpriteSlivers(40);
  ensure(!te.rangeOver && te.timeOver && te.count==34,"34 sliver time quota");
  ensure((quota.read(0x213E)&0x80)!=0,"STAT77 time-over latch");
  // The fast sprite-row compositor agrees with point sampling on real VRAM data.
  PpuState tile;tile.tm=0x10;tile.brightness=15;
  for(unsigned i=0;i<128;i++)tile.oam[i*4+1]=128;
  opaqueSprite(tile,0,16,30,0x00);
  opaqueSprite(tile,1,16,30,0x32);
  tile.vram[0]=0x80;tile.cgram[258]=0x1f;tile.cgram[290]=0xe0;tile.cgram[291]=3;
  auto row=tile.buildSpriteRow(30);
  auto pt=tile.sampleSprites(16,30);
  ensure(row[16].valid && row[16].oamIndex==0 && pt.oamIndex==row[16].oamIndex,"OBJ row/scalar OAM order");
  auto frame=tile.renderFrame();
  ensure(frame[30*256+16]==tile.rgba15(tile.finalMain15(16,30,false)),"Static scanline matches compositor");
  // Active display prohibits VRAM updates; only the VMAIN address advances.
  SnesRuntime gate;gate.frameTimingActive=true;gate.currentScanline=40;
  gate.ppu.vmain=0;gate.ppu.vmadd=0;gate.ppu.forceBlank=false;
  gate.ppuPortWrite(0x2118,0x55);
  ensure(gate.ppu.vram[0]==0 && gate.ppu.vmadd==1,"VRAM active-display gate and address increment");
  gate.currentScanline=gate.visibleLines();gate.ppuPortWrite(0x2118,0x66,true);
  ensure(gate.ppu.vram[2]==0x66 && gate.ppu.vmadd==2,"DMA VBlank VRAM write");
  gate.ppu.forceBlank=true;gate.currentScanline=40;gate.ppuPortWrite(0x2118,0x77);
  ensure(gate.ppu.vram[4]==0x77,"forced blank permits VRAM writes");
  // Range/time flags are cleared by the host at the beginning of the next frame.
  SnesRuntime hw;hw.ppu.objRangeTimeFlags=0xc0;hw.beginFrame();
  ensure(hw.ppu.objRangeTimeFlags==0,"STAT77 flags must reset each frame");
  std::cout<<"DKC3_PPU_CROSSFEED_PASS mode7=latches brightness=parity obj_range=32 obj_time=34 stat77=reset vram=timed raster=consistent\n";
  return 0;
}catch(const std::exception& e){std::cerr<<"DKC3_PPU_CROSSFEED_FAIL: "<<e.what()<<'\n';return 1;}}
