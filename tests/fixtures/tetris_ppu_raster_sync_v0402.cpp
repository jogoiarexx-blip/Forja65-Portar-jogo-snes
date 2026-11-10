#include "runtime.hpp"
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <iterator>

static void require(bool ok,const char*msg){if(!ok)throw std::runtime_error(msg);}
static void configure(SnesRuntime& hw){
  hw.headless=true;
  hw.ppu.write(0x2100,0x0Fu);
  hw.ppu.write(0x2121,0x00u);
  hw.ppu.write(0x2122,0x1Fu);
  hw.ppu.write(0x2122,0x00u);
  hw.frameTimingActive=true;
  hw.currentScanline=30u;
  hw.currentMasterCycle=540u;
  hw.rasterCursorX=0;
  hw.fbWidth=256u;
  hw.fbHeight=224u;
  hw.framebuffer.assign(256u*224u,0xFF000000u);
}
int main(){
  try{
    SnesRuntime reference,optimized;
    configure(reference);configure(optimized);
    optimized.ppuRegisterProfileEnabled=true;
    auto send=[&](std::uint16_t reg,std::uint8_t val){
      // v0.4.01 baseline: flush raster BEFORE EVERY PPU register write.
      reference.syncPpuBeforeMutation();
      if((reg==0x2118u||reg==0x2119u)&&!reference.vramAccessibleNow())reference.ppu.writeVramDataIgnored(reg,val);
      else reference.ppu.write(reg,val);
      optimized.ppuPortWrite(reg,val);
    };
    // Address-only writes must not cause raster recomposition.
    send(0x2115u,0x80u);send(0x2116u,0x12u);send(0x2117u,0x00u);
    send(0x2121u,0x00u);
    require(optimized.ppuAddressOnlyRasterSkips==4u,"address-only optimization not used");
    require(optimized.rasterCursorX==0u,"address writes should not flush raster");
    require(reference.rasterCursorX>0u,"reference compositor did not flush");
    // VRAM and palette DATA writes must flush before they mutate live pixels.
    send(0x2118u,0x55u);send(0x2119u,0xAAu);
    send(0x2122u,0x00u);send(0x2122u,0x7Cu);
    require(reference.framebufferHash()==optimized.framebufferHash(),"pixels changed during data-port flush");
    require(reference.ppu.vram==optimized.ppu.vram&&reference.ppu.cgram==optimized.ppu.cgram,"VRAM/CGRAM differ");
    reference.renderVisibleUntilMasterCycle(30u,790u);
    optimized.renderVisibleUntilMasterCycle(30u,790u);
    require(reference.framebufferHash()==optimized.framebufferHash(),"post-mutation raster differs");
    // OAM address writes retain the conservative sync: priority rotation can change OBJ ordering.
    reference.currentMasterCycle=920u;optimized.currentMasterCycle=920u;
    const auto cursor=optimized.rasterCursorX;
    send(0x2102u,0x14u);send(0x2103u,0x80u);
    require(optimized.rasterCursorX>cursor,"OAM rotation write skipped raster sync");
    require(reference.framebufferHash()==optimized.framebufferHash(),"OAM address write changed image");
    require(reference.ppu.oamAddr==optimized.ppu.oamAddr&&reference.ppu.vmadd==optimized.ppu.vmadd,"address latch state differs");
    (void)optimized.ppuPortRead(0x2139u);
    const std::string path="ppu-raster-sync-register-profile-smoke.csv";
    optimized.writePpuRegisterProfile(path);
    std::ifstream in(path);require((bool)in,"register profile was not written");
    const std::string contents((std::istreambuf_iterator<char>(in)),{});
    require(contents.find("0x2115,0,1,1")!=std::string::npos,"VMAIN write missing from profile");
    require(contents.find("0x2139,1,0,1")!=std::string::npos,"VRAM read missing from profile");
    require(contents.find("# address_only_raster_sync_skips,4")!=std::string::npos,"skip count missing from profile");
    std::cout<<"TETRIS_PPU_RASTER_SYNC_PASS skips="<<optimized.ppuAddressOnlyRasterSkips<<"\n";
    return 0;
  }catch(const std::exception&e){std::cerr<<"TETRIS_PPU_RASTER_SYNC_FAIL "<<e.what()<<"\n";return 1;}
}
