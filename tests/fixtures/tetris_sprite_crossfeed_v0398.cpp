#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <iostream>
#include <stdexcept>

static void testSpriteMemoryMapping(){
    PpuState p;
    for(unsigned i=1;i<128;i++)p.oam[512+i/4]|=(std::uint8_t)(1u<<((i%4)*2));
    p.oam[0]=16;p.oam[1]=16;p.oam[2]=0;p.oam[3]=1; // second sprite table
    p.cgram[129*2]=31;
    p.vram[0x2000]=0x80; // OBSEL name-select zero still starts 0x2000 bytes after first table
    assert(p.sampleSprites(16,16).valid);
    assert(p.buildSpriteRow(16)[16].valid);
    p.vram.assign(0x10000,0);
    p.obsel=0x1A; // base bits = 2, name select = 3; bank wraps to VRAM 0
    p.vram[0]=0x80;
    assert(p.sampleSprites(16,16).valid);
    assert(p.buildSpriteRow(16)[16].valid);
    p.obsel=2;p.oam[3]=0;p.vram.assign(0x10000,0);p.vram[0x8000]=0x80;
    assert(p.sampleSprites(16,16).valid); // primary bank $8000
}
static void testSpriteWrapAndPriority(){
    PpuState p;
    for(unsigned i=2;i<128;i++)p.oam[512+i/4]|=(std::uint8_t)(1u<<((i%4)*2));
    p.oam[0]=16;p.oam[1]=252;p.oam[2]=0;p.oam[3]=0; // first is low priority, red
    p.oam[4]=16;p.oam[5]=252;p.oam[6]=1;p.oam[7]=0x32; // second high priority, green
    p.oam[512]=0x0A; // both are 16x16: size bits 1 for sprite 0 and 1
    p.obsel=0;
    p.cgram[2*129]=31;
    p.cgram[2*145+1]=0x03;
    p.vram[8]=0x80; // tile row 4 at y=0, sprite 0
    p.vram[32+8]=0x80; // tile row 4 at y=0, sprite 1
    auto scalar=p.sampleSprites(16,0),row=p.buildSpriteRow(0)[16];
    assert(scalar.valid&&row.valid);
    assert(scalar.oamIndex==0&&row.oamIndex==0); // OAM order, not priority bits
    assert(scalar.c15==31&&row.c15==31);
    // Priority rotation beginning at sprite 1 must reverse the overlap winner.
    p.regs[3]=0x80;p.oamAddr=2;
    scalar=p.sampleSprites(16,0);row=p.buildSpriteRow(0)[16];
    assert(scalar.valid&&row.valid&&scalar.oamIndex==1&&row.oamIndex==1);
    assert(scalar.c15==p.palette15(145)&&row.c15==scalar.c15);
}
static void testScalarRowParity(){
    PpuState p;
    unsigned seed=0x1234ABCD;
    auto rnd=[&](){seed=seed*1664525u+1013904223u;return seed>>24;};
    for(unsigned iteration=0;iteration<32;iteration++){
        for(auto& v:p.vram)v=(std::uint8_t)rnd();
        for(auto& v:p.oam)v=(std::uint8_t)rnd();
        for(auto& v:p.cgram)v=(std::uint8_t)rnd();
        p.obsel=(std::uint8_t)rnd();p.regs[3]=(std::uint8_t)rnd();p.oamAddr=(std::uint16_t)rnd();
        for(int y:{0,7,111,223,255}){
            auto row=p.buildSpriteRow(y);
            for(int x=0;x<256;x++){
                auto a=row[(unsigned)x],b=p.sampleSprites(x,y);
                if(a.valid!=b.valid||(a.valid&&(a.c15!=b.c15||a.oamIndex!=b.oamIndex||a.priority!=b.priority||a.objPal!=b.objPal)))
                    throw std::runtime_error("OBJ fast/slow mismatch at random row");
            }
        }
    }
}
static void testOamVblankAddressReload(){
    SnesRuntime hw("assets/cart-data.bin",MapperKind::LoROM,0u,10u,0u,CartChip::None,"sprite-crossfeed.srm",1u,true);
    hw.ppu.write(0x2100,15);hw.ppu.write(0x2102,0x12);hw.ppu.write(0x2103,0x80);
    hw.ppu.oamAddr=99;hw.ppu.oamFlip=true;hw.ppu.oamReadFlip=true;
    hw.beginVblank(hw.visibleLines());
    assert(hw.ppu.oamAddr==0x12&&!hw.ppu.oamFlip&&!hw.ppu.oamReadFlip);
    hw.ppu.write(0x2100,0x8F);hw.ppu.oamAddr=88;hw.beginVblank(hw.visibleLines());
    assert(hw.ppu.oamAddr==88); // forced blank suppresses automatic cursor reload
}
static void testDmaToSprite(){
    SnesRuntime hw("assets/cart-data.bin",MapperKind::LoROM,0u,10u,0u,CartChip::None,"sprite-crossfeed.srm",1u,true);
    hw.write8(0x2100,0x80u); // VRAM DMA during forced blank.
    hw.write8(0x2101,0u);
    hw.write8(0x2115,0x80u);hw.write8(0x2116,0u);hw.write8(0x2117,0x10u);
    hw.ram[0x100]=0x80;hw.ram[0x101]=0x00;
    auto& d=hw.dma[0];d={};d.dmap=1;d.bbad=0x18;d.a1b=0x7E;d.a1t=0x0100;d.das=2;
    hw.executeDma(1);
    assert(hw.ppu.vram[0x2000]==0x80);
    hw.ppu.oam[0]=16;hw.ppu.oam[1]=16;hw.ppu.oam[2]=0;hw.ppu.oam[3]=1;
    for(unsigned i=1;i<128;i++)hw.ppu.oam[512+i/4]|=(std::uint8_t)(1u<<((i%4)*2));
    assert(hw.ppu.sampleSprites(16,16).valid);
}
int main(){testSpriteMemoryMapping();testSpriteWrapAndPriority();testScalarRowParity();testOamVblankAddressReload();testDmaToSprite();
    std::cout<<"TETRIS_SPRITE_CROSSFEED_PASS OBJ_BANK OAM_ORDER ROTATION Y_WRAP FAST_SLOW DMA\n";}
