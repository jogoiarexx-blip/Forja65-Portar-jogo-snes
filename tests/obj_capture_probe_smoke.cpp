// Generic SNES regression: the isolated sprite capture must match the
// actual runtime compositor, including rectangular 16x32 sprites and Y rows.
#include "runtime.hpp"
#include "capture_test_io.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>
static void require(bool test, const char*message){if(!test)throw std::runtime_error(message);}
int main(){
 try {
  SnesRuntime hw;
  hw.ppu.obsel=0xC0u; // size mode 6: 16x32 small OBJ
  hw.ppu.tm=0x10;hw.ppu.brightness=15;
  auto dims=hw.ppu.objDims(false);require(dims.first==16&&dims.second==32,"non-square OBJ size");
  hw.ppu.oam[0]=20;hw.ppu.oam[1]=20;hw.ppu.oam[2]=0;hw.ppu.oam[3]=0;
  for(unsigned i=1;i<128;i++)hw.ppu.oam[512+i/4]|=(std::uint8_t)(1u<<((i%4)*2));
  hw.ppu.vram[0x600]=0x80; // tile at (0,3) in 16x32 sprite
  hw.ppu.cgram[258]=31;
  auto pixel=hw.ppu.buildSpriteRow(44)[20];
  require(pixel.valid&&pixel.oamIndex==0,"runtime 16x32 fourth tile row");
  const auto dir=std::filesystem::temp_directory_path()/"forja65_obj_v0381_capture";
  std::filesystem::create_directories(dir);
  const auto img=dir/"sprites.nspr",idx=dir/"sprites.txt";
  require(hw.writeNativeOamLayer(img,idx),"export OBJ layer");
  const auto bytes=forja65_test::readCaptureFile(img,true);
  require(bytes.size()>20+((44*256+20)*4+3),"exported image length");
  const auto pos=20+(44*256+20)*4;
  require((unsigned char)bytes[pos+3]==255,"exported non-square sprite pixel present");
  require((unsigned char)bytes[20+(20*256+20)*4+3]==0,"transparent upper section stays transparent");
  const auto meta=forja65_test::readCaptureFile(idx);
  require(meta.find("width=16 height=32")!=std::string::npos,"correct rectangular metadata");
  require(meta.find("visible_pixels=1")!=std::string::npos,"exporter tracks actual visible pixels");
  const auto csv=dir/"obj-probe.csv";
  std::filesystem::remove(csv);
#ifdef _WIN32
  _putenv_s("FORJA65_OBJ_PROBE_PATH",csv.string().c_str());
  _putenv_s("FORJA65_OBJ_PROBE_START","3");
#else
  setenv("FORJA65_OBJ_PROBE_PATH",csv.string().c_str(),1);
  setenv("FORJA65_OBJ_PROBE_START","3",1);
#endif
  hw.frameCounter=2;hw.appendObjInputProbe();require(!std::filesystem::exists(csv),"probe start filter");
  hw.frameCounter=3;hw.setJoy1(0x0100);hw.appendObjInputProbe();
  const auto lines=forja65_test::readCaptureFile(csv);
  require(lines.find("frame,pc,joy1,joy2")!=std::string::npos,"probe CSV header");
  require(lines.find("3,0,100,0,")!=std::string::npos,"probe records frame and input");
  std::filesystem::remove_all(dir);
  std::cout<<"OBJ_RECTANGULAR_CAPTURE_AND_INPUT_PROBE_PASS\n";
  return 0;
 } catch(const std::exception&e){std::cerr<<"OBJ_RECTANGULAR_CAPTURE_AND_INPUT_PROBE_FAIL "<<e.what()<<'\n';return 1;}
}
