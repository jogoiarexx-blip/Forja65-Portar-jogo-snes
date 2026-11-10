#include "runtime.hpp"
#include "capture_test_io.hpp"
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <sstream>
#include <vector>
static void envset(const char*key,const char*value){
#ifdef _WIN32
  _putenv_s(key,value);
#else
  setenv(key,value,1);
#endif
}
static int check(bool condition,const char*message){if(!condition)std::cerr<<message<<"\n";return condition?0:1;}
int main(){try{
  constexpr const char*file="dma-forensics-smoke.csv";
  std::filesystem::remove(file);
  envset("FORJA65_DMA_FORENSICS_PATH",file);
  envset("FORJA65_DMA_FORENSICS_START","5");
  envset("FORJA65_DMA_FORENSICS_END","5");
  SnesRuntime hw;
  hw.ppu.write(0x2102,0);hw.ppu.write(0x2103,0);
  hw.ram[0]=0x29;hw.ram[1]=0x73;hw.ram[2]=0xF1;hw.ram[3]=0x05;
  hw.dma[0].dmap=0;hw.dma[0].bbad=4;
  hw.dma[0].a1b=0x7e;hw.dma[0].a1t=0;hw.dma[0].das=4;
  hw.frameCounter=4;const auto offClock=hw.cpuMasterClock;hw.executeDma(1);
  const auto offCycles=hw.cpuMasterClock-offClock;
  if(check(!std::filesystem::exists(file),"filtered DMA unexpectedly wrote file"))return 1;
  if(check(hw.ppu.oam[0]==0x29&&hw.ppu.oam[1]==0x73&&hw.ppu.oam[2]==0xF1&&hw.ppu.oam[3]==0x05,"OAM transfer changed by probe"))return 2;
  hw.ppu.write(0x2102,0);hw.ppu.write(0x2103,0);
  hw.dma[0].a1t=0;hw.dma[0].das=4;
  hw.frameCounter=5;const auto onClock=hw.cpuMasterClock;hw.executeDma(1);
  if(check(hw.cpuMasterClock-onClock==offCycles,"audit changed DMA master-cycle accounting"))return 9;
  if(check(hw.ppu.oam[0]==0x29&&hw.ppu.oam[1]==0x73&&hw.ppu.oam[2]==0xF1&&hw.ppu.oam[3]==0x05,"audited OAM differs"))return 3;
  // Second transfer uses the same read bus and writes interleaved VRAM ports.
  hw.ppu.write(0x2115,0x80);hw.ppu.write(0x2116,0);hw.ppu.write(0x2117,0);
  hw.dma[0].dmap=1;hw.dma[0].bbad=0x18;
  hw.dma[0].a1t=0;hw.dma[0].das=4;
  hw.executeDma(1);
  if(check(hw.ppu.vram[0]==0x29&&hw.ppu.vram[1]==0x73&&hw.ppu.vram[2]==0xF1&&hw.ppu.vram[3]==0x05,"VRAM DMA inconsistent"))return 4;
  std::istringstream input(forja65_test::readCaptureFile(file));std::string line;std::vector<std::string>lines;
  while(std::getline(input,line))lines.push_back(line);
  if(check(lines.size()==3,"expected only two audited transfers"))return 5;
  if(check(lines[0].find("oam_bytes,vram_bytes,cgram_bytes")!=std::string::npos,"header missing target counts"))return 6;
  if(check(lines[1].find(",4,0,0,")!=std::string::npos,"OAM target count wrong"))return 7;
  if(check(lines[2].find(",0,4,0,")!=std::string::npos,"VRAM target count wrong"))return 8;
  std::filesystem::remove(file);
  std::cout<<"DMA_FORENSICS_V031_PASS filtered=1 oam=4 vram=4\n";
  return 0;
}catch(const std::exception&e){std::cerr<<"DMA_FORENSICS_FAIL "<<e.what()<<'\n';return 1;}
}
