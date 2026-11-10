#include "runtime.hpp"
#include "capture_test_io.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
static void check(bool v,const char*msg){if(!v)throw std::runtime_error(msg);}
int main(){try{
  SnesRuntime hw;auto&p=hw.ppu;
  p.brightness=15;p.tm=0x11;p.bgmode=1;
  p.bgsc[0]=0x04; // BG1 map at byte $0800, 4bpp tiles at $0000.
  p.oam[0]=16;p.oam[1]=16;p.oam[2]=0;p.oam[3]=0x00;
  for(unsigned i=1;i<128;i++)p.oam[512+i/4]|=(std::uint8_t)(1u<<((i%4)*2));
  p.vram[0]=0x80; // one opaque OBJ pixel at 16,16
  p.vram[32]=0x80; // one opaque BG1 pixel in tile #1
  auto mapAddr=0x0800u+2u*(2u+2u*32u);
  p.vram[mapAddr]=1;p.vram[mapAddr+1]=0x20; // tile #1, HIGH priority
  p.cgram[2]=0xE0;p.cgram[3]=0x03; // green background
  p.cgram[258]=0x1F;p.cgram[259]=0; // red OBJ
  auto bg=p.explainPixel(16,16);
  check(bg.obj.valid&&bg.objEnabled&&!bg.objWindowed,"OBJ available on main screen");
  check(bg.winner.source==0&&bg.winner.priority==15,"BG wins on high priority");
  check(bg.finalColor==bg.winner.c15,"no color math in baseline");
  p.oam[3]=0x30; // OBJ priority 3 -> depth 16
  auto obj=p.explainPixel(16,16);
  check(obj.winner.source==4&&obj.winner.oamIndex==0,"OBJ wins at higher priority");
  p.tmw=0x10;p.wobjsel=0x02;p.wh[0]=16;p.wh[1]=16;
  auto masked=p.explainPixel(16,16);
  check(masked.objWindowed&&masked.winner.source==0,"OBJ window masks without deleting sprite");
  p.tmw=0;p.tm=0x01;
  auto disabled=p.explainPixel(16,16);
  check(disabled.obj.valid&&!disabled.objEnabled&&disabled.winner.source==0,"OBJ disabled by TM");
  p.tm=0x10; // OBJ only, opaque OBJ pixel, enable color math on palette 4.
  p.oam[3]=0x38;p.cgadsub=0x10;p.cgwsel=0;p.fixedR=6;
  p.cgram[2*(128+4*16+1)]=8;
  auto color=p.explainPixel(16,16);
  check(color.winner.source==4&&color.colorChanged,"color math identified separately from BG occlusion");
  hw.fbWidth=256;hw.fbHeight=224;hw.framebuffer=p.renderFrame(256,224);
  namespace fs=std::filesystem;auto dir=fs::temp_directory_path()/"forja65_pixel_ownership_v0389";
  fs::create_directories(dir);
  check(hw.writePixelOwnership(dir),"pixel ownership CSV/map creation");
  const auto s=forja65_test::readCaptureFile(dir/"pixel-ownership.csv");
  check(s.find("reason,final_color_changed,snapshot_matches_frame")!=std::string::npos,"CSV schema");
  check(s.find("16,16,0,16,4,16,0,obj_wins,1,1")!=std::string::npos,"CSV winner / math / snapshot integrity");
  const auto info=forja65_test::readCaptureFile(dir/"pixel-ownership-summary.txt");
  check(info.find("snapshot_differs_frame=0")!=std::string::npos,"snapshot exactness on stationary PPU");
  fs::remove_all(dir);
  std::cout<<"PIXEL_OWNERSHIP_PROVENANCE_PASS bg/obj/window/disabled/math/capture\n";return 0;
 }catch(const std::exception&e){std::cerr<<"PIXEL_OWNERSHIP_PROVENANCE_FAIL "<<e.what()<<'\n';return 1;}}
