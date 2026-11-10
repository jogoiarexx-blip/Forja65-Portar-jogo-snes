#include "runtime.hpp"
#include <iostream>
#include <filesystem>
#include <stdexcept>
static void check(bool v,const char*m){if(!v)throw std::runtime_error(m);}
int main(){
 try{
 namespace fs=std::filesystem;
 const std::string rom="assets/cart-data.bin";
 std::string expected;
 {
  SnesRuntime h(rom,MapperKind::LoROM,128,5,0,CartChip::None,"save.srm",1,true);
  expected=h.sramPath;
  check(expected.rfind("saves/",0)==0,"SRAM path must be namespaced per ROM");
  check(h.sram.size()==128,"test SRAM size");
  h.write8(0x700000u,0xA7u);
  check(h.sram[0]==0xA7u&&h.sramDirty,"bus write must set SRAM dirty flag");
  h.frameCounter=299u;
  h.headless=false;
  h.endVblank();
  h.headless=true;
  check(!h.sramDirty&&fs::exists(expected),"autosave at 300 frames");
 }
 {
  SnesRuntime h(rom,MapperKind::LoROM,128,5,0,CartChip::None,"save.srm",1,true);
  check(h.sramPath==expected,"save path changed between runs");
  check(h.sram[0]==0xA7u,"SRAM did not persist across reboot");
 }
 std::cout<<"REV201_PERSISTENT_SRAM_PASS path="<<expected<<"\n";
 }catch(const std::exception &e){std::cerr<<e.what()<<"\n";return 1;}
}
