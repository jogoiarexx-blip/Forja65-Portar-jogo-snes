#include "runtime.hpp"
#include <array>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

struct Score{int pass=0,fail=0;void check(bool ok){ok?++pass:++fail;}};
static std::vector<unsigned> events(const std::string&path){
  std::ifstream in(path);std::string line;std::vector<unsigned> result;
  while(std::getline(in,line)){
    if(line.empty()||line[0]=='#'||line.rfind("seq,",0)==0)continue;
    std::stringstream s(line);std::string field;int col=0;
    while(std::getline(s,field,',')){if(col==6){result.push_back((unsigned)std::stoul(field));break;}++col;}
  }
  return result;
}
static void setCart(SnesRuntime&h){h.mapper=MapperKind::LoROM;h.cart.assign(0x8000u,0);h.romLogicalSize=h.cart.size();h.cart.back()=0x48;h.ram[0]=0xA6;}
#ifdef FORJA_REV131
static std::uint32_t getWord(SnesRuntime&h,std::uint32_t a,bool bank0){return h.readW(a,16,bank0);}
static void putWord(SnesRuntime&h,std::uint32_t a,std::uint16_t val,bool bank0){h.write(a,val,16,bank0);}
static void incWord(CpuState&c,SnesRuntime&h,std::uint32_t a,bool bank0){c.incMem(h,a,16,bank0);}
#else
static std::uint32_t getWord(SnesRuntime&h,std::uint32_t a,bool){return h.readW(a,16);}
static void putWord(SnesRuntime&h,std::uint32_t a,std::uint16_t val,bool){h.write(a,val,16);}
static void incWord(CpuState&c,SnesRuntime&h,std::uint32_t a,bool){c.incMem(h,a,16);}
#endif
int main(){
 Score s; SnesRuntime h;setCart(h);CpuState cpu;
 const std::string path="bank0-address.csv";
 auto trace=[&](auto call){h.busClockTrace.start(path);call();h.busClockTrace.close();return events(path);};
 // Direct page and stack-relative bytes stay on bank $00 at $FFFF + 1.
 for(int i=0;i<12;i++){
   const auto addresses=trace([&]{(void)getWord(h,0x00ffffu,true);});
   s.check(addresses.size()==2);
   s.check(addresses.size()==2&&addresses[0]==0x00ffffu);
   s.check(addresses.size()==2&&addresses[1]==0x000000u);
 }
 // Indexed absolute and long operand accesses must NOT accidentally wrap.
 for(int i=0;i<8;i++){
   const auto addresses=trace([&]{(void)getWord(h,0x00ffffu,false);});
   s.check(addresses.size()==2);
   s.check(addresses.size()==2&&addresses[1]==0x010000u);
 }
 // Direct-page 16-bit stores wrap high byte to $00:0000, retaining byte order.
 for(int i=0;i<8;i++){
   const auto addresses=trace([&]{putWord(h,0x00ffffu,0x319eu,true);});
   s.check(addresses.size()==2);
   s.check(addresses.size()==2&&addresses[0]==0x00ffffu);
   s.check(addresses.size()==2&&addresses[1]==0x000000u);
   s.check(h.ram[0]==0x31u);
 }
 // RMW remains read/read/write(high)/write(low), but uses the bank0 high address.
 for(int i=0;i<8;i++){
   const auto addresses=trace([&]{incWord(cpu,h,0x00ffffu,true);});
   s.check(addresses.size()==4);
   s.check(addresses.size()==4&&addresses[0]==0x00ffffu);
   s.check(addresses.size()==4&&addresses[1]==0x000000u);
   s.check(addresses.size()==4&&addresses[2]==0x000000u);
   s.check(addresses.size()==4&&addresses[3]==0x00ffffu);
 }
 std::cout<<"CPU_BANK0_WORD_WRAP_REV131 pass="<<s.pass<<" fail="<<s.fail<<" total="<<s.pass+s.fail<<"\n";
 return s.fail?1:0;
}
