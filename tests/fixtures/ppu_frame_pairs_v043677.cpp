#include "runtime.hpp"
#include <algorithm>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

static void require(bool valid,const char *why){if(!valid)throw std::runtime_error(why);}
static void writePpm(const std::filesystem::path &name, const std::vector<std::uint32_t> &pixels,unsigned w,unsigned h){
  require(pixels.size()==std::size_t(w)*h,"frame size mismatch");
  std::ofstream out(name,std::ios::binary);
  if(!out)throw std::runtime_error("cannot write PPM");
  out<<"P6\n"<<w<<' '<<h<<"\n255\n";
  for(auto v:pixels){
    const char b[3]={(char)(v>>16),(char)(v>>8),(char)v};
    out.write(b,3);
  }
  if(!out)throw std::runtime_error("PPM write failed");
}
static std::unique_ptr<SnesRuntime> scene(unsigned mode,unsigned field,unsigned screenInterlace,
                                         unsigned objInterlace,unsigned numberOfSprites){
  auto h=std::make_unique<SnesRuntime>();h->headless=true;h->interlaceField=field!=0;h->beginFrame();
  auto &p=h->ppu;p.forceBlank=false;p.tm=0x10;p.ts=0;p.brightness=15;p.bgmode=(std::uint8_t)mode;
  p.setini=(std::uint8_t)(screenInterlace|(objInterlace<<1u));p.obsel=3u<<5u;
  std::fill(p.oam.begin(),p.oam.end(),0);
  std::fill(p.vram.begin(),p.vram.end(),0);
  std::fill(p.cgram.begin(),p.cgram.end(),0);
  for(unsigned i=0;i<128u;i++){
    p.oam[4u*i]=(std::uint8_t)(16u+(i%8u)*12u);
    p.oam[4u*i+1u]=200;
  }
  for(unsigned i=0;i<numberOfSprites;i++){
    p.oam[4u*i]=(std::uint8_t)(16u+(i%8u)*12u);
    p.oam[4u*i+1u]=40;
    p.oam[4u*i+2u]=(std::uint8_t)(i%2u);
    p.oam[4u*i+3u]=(std::uint8_t)((i%4u)<<4u);
  }
  for(unsigned i=0;i<256;i++){
    p.cgram[2*i]=(std::uint8_t)(i*7u+3u);
    p.cgram[2*i+1]=(std::uint8_t)(i*5u);
  }
  for(unsigned row=0;row<8u;row++)for(unsigned t=0;t<2;t++){
    p.vram[t*32u+2u*row]=(std::uint8_t)(0xFFu >> ((row+t)%3));
    p.vram[t*32u+2u*row+1u]=(std::uint8_t)(0x01u<<((row+t)%7));
    p.vram[t*32u+16u+2u*row]=(std::uint8_t)(0x40u>>((row+t)%3));
  }
  h->configureFramebuffer();h->beginScanline(40);h->wramRefreshAppliedThisLine=true;h->hdmaExecutedThisLine=true;
  return h;
}
int main(int argc,char**argv){
  try{
    require(argc==2,"usage: ppu_frame_pairs_v043677 OUTPUT_DIR");
    const std::filesystem::path root(argv[1]);
    std::filesystem::create_directories(root/"reference");
    std::filesystem::create_directories(root/"actual");
    struct Case{const char*name;unsigned mode,field,screen,obj,count;bool mutateOam,mutateVram;};
    const Case cases[]={
      {"mode0_obj_priority",0,0,0,0,2,false,false},
      {"mode5_obj_field1",5,1,1,1,4,false,false},
      {"mode6_obj_field0",6,0,0,1,4,false,false},
      {"obj_32_sprite_limit",0,0,0,0,33,false,false},
      {"oam_latch_stability",0,0,0,0,1,true,false},
      {"chr_latch_stability",0,0,0,0,1,false,true},
    };
    for(const auto &c:cases){
      auto h=scene(c.mode,c.field,c.screen,c.obj,c.count);
      h->advanceCpuMasterCycles(1364u);
      require(h->currentScanline==41u,"bad HBlank commit");
      require(h->hasTimedObjRow(41u),"missing timed OBJ row");
      auto&p=h->ppu;
      // Scanline 40 has already been rasterized while advancing the clock.
      // Compare the same historical frame plus an independently drawn row 41.
      std::vector<std::uint32_t> expected=h->framebuffer;
      p.renderOutputSegment(expected,41u,0,p.outputWidth(),c.field);
      if(c.mutateOam){p.oam[0]=105;p.oam[1]=120;}
      if(c.mutateVram)std::fill(p.vram.begin(),p.vram.end(),0);
      h->finishVisibleLine(41u);
      require(h->fbWidth==p.outputWidth(),"inconsistent width");
      require(h->fbHeight==p.outputHeight(),"inconsistent height");
      writePpm(root/"reference"/(std::string(c.name)+".ppm"),expected,h->fbWidth,h->fbHeight);
      writePpm(root/"actual"/(std::string(c.name)+".ppm"),h->framebuffer,h->fbWidth,h->fbHeight);
    }
    std::cout<<"PPU_FRAME_PAIRS_V043677_PASS scenes="<<(sizeof(cases)/sizeof(cases[0]))<<'\n';
    return 0;
  }catch(const std::exception &e){std::cerr<<"PPU_FRAME_PAIRS_V043677_FAIL "<<e.what()<<'\n';return 1;}
}
