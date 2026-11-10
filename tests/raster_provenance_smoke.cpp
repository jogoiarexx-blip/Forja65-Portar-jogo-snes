#include "runtime.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
int main(){
 try {
  SnesRuntime hw;
  hw.beginFrame();
  hw.ppuPortWrite(0x2100u,0x0Fu);
  hw.ppuPortWrite(0x2105u,0x01u);
  hw.ppuPortWrite(0x212Cu,0x10u);
  hw.ppuPortWrite(0x2126u,39u);
  hw.ppuPortWrite(0x2127u,41u);
  hw.ppu.oam[0]=40u;hw.ppu.oam[1]=10u;
  hw.ppu.vram[0]=0x80u;
  // OBJ palette 0 color 1: red.
  hw.ppu.cgram[258]=0x1Fu;
  hw.renderVisibleLine(10);
  if(hw.framebuffer[10u*256u+40u]!=hw.ppu.rgba15(0x1Fu))return 3;
  hw.finishRasterTrace();
  const char*p=std::getenv("FORJA65_CAPTURE_DIR");
  if(!p)return 4;
  namespace fs=std::filesystem;
  const fs::path dir(p);
  for(const char*name:{"raster-pixels.csv","raster-segments.csv","raster-writes.csv","raster-summary.txt"})
   if(!fs::exists(dir/name)||!fs::file_size(dir/name))return 5;
  std::ifstream in(dir/"raster-pixels.csv");
  std::string line;std::getline(in,line);
  if(line.find("obj_rgb")==std::string::npos||line.find("bg_source")==std::string::npos||line.find("occlusion_cause")==std::string::npos)return 6;
  bool found=false;
  while(std::getline(in,line)){
   std::istringstream ss(line);std::string part;
   std::getline(ss,part,',');if(part!="1")continue;
   std::getline(ss,part,',');if(part!="10")continue;
   std::getline(ss,part,',');if(part!="40")continue;
   if(line.find(",1,")==std::string::npos)return 7;
   found=true;break;
  }
  if(!found)return 8;
  std::ifstream writes(dir/"raster-writes.csv");
  std::string payload((std::istreambuf_iterator<char>(writes)),{});
  if(payload.find(",8492,16,")==std::string::npos)return 9;
  std::cout<<"FORJA65_RASTER_PROVENANCE_PASS\n";
  return 0;
 }catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 2;}
}
