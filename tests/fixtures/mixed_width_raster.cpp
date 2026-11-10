#include "runtime.hpp"
#include <iostream>
#include <memory>
#include <stdexcept>
static void require(bool condition,const char*message){if(!condition)throw std::runtime_error(message);}
static void color(PpuState&p,unsigned c){p.forceBlank=false;p.brightness=15;p.bgmode=0;p.tm=p.ts=0;p.cgram[0]=c&255;p.cgram[1]=c>>8;}
int main(){try{
 auto h=std::make_unique<SnesRuntime>();h->sa1Side=true;color(h->ppu,0x001f);h->ppu.setini=8;h->configureFramebuffer();require(h->fbWidth==512,"hires canvas setup");h->renderRuntimeSegment(0,0,512);const auto red=h->ppu.rgba15(0x001f);color(h->ppu,0x03e0);h->ppu.setini=0;h->renderRuntimeSegment(180,0,512);const auto green=h->ppu.rgba15(0x03e0);
 for(unsigned x=0;x<512;x++)require(h->framebuffer[180*512+x]==green,"lores HUD must use fixed canvas stride and occupy its original scanline");
 for(unsigned x=0;x<512;x++)require(h->framebuffer[90*512+x]!=green,"lores HUD must not be moved to half-height");
 require(h->framebuffer[0]==red,"previous hires line must be preserved");
 auto p=std::make_unique<SnesRuntime>();p->sa1Side=true;color(p->ppu,0x001f);p->ppu.setini=0;p->configureFramebuffer();p->renderRuntimeSegment(0,0,256);p->rasterCursorX=0;color(p->ppu,0x03e0);p->ppu.setini=8;p->renderVisibleUntilMasterCycle(1,SnesRuntime::HBLANK_START_MC);require(p->fbWidth==512,"later hires line must promote the frame canvas");for(unsigned x=0;x<512;x++){require(p->framebuffer[x]==red,"promotion must duplicate previous lores pixels");require(p->framebuffer[512+x]==green,"hires line must occupy its full width");}
 std::cout<<"PASS mixed-width raster preserves stride, line position and earlier pixels\n";
 }catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
