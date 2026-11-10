#include "runtime.hpp"
#include <memory>
#include <iostream>
#include <stdexcept>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
static void must(bool b,const char*m){if(!b)throw std::runtime_error(m);}
static std::unique_ptr<SnesRuntime> fixture(CpuState&cpu,bool native,bool longCall){
 auto h=std::make_unique<SnesRuntime>();h->headless=true;h->romLogicalSize=32768;
 std::vector<std::uint8_t> rom(32768,0xea);
 const std::uint8_t code[]={0x5a,0xf4,0x06,0x81,0x6c,0x1a,0x00,0x7a,0x6b};
 std::copy(std::begin(code),std::end(code),rom.begin()+0x100);
 if(native){h->nativeRom.logicalSize=32768;h->nativeRom.regions.push_back({0,std::move(rom)});}
 else h->cart=std::move(rom);
 cpu.e=false;cpu.pb=0x80;cpu.s=0x1f0;
 h->ram[0x1f1]=0x06;h->ram[0x1f2]=0x81;
 NativeReturnFrame f{};f.longCall=longCall;f.stackTracked=true;f.stackPointer=cpu.s+(longCall?4u:2u);h->nativeReturns.push_back(f);
 return h;
}
int main(){try{
 unsigned checks=0;
 for(bool native:{false,true})for(bool longCall:{false,true}){
  CpuState c;auto h=fixture(c,native,longCall);
  auto arm=[&](){return longCall?h->armConstructedShortReturn(0x808104,c):h->armPeaJumpShortReturn(0x808104,c);};
  must(arm(),native?"native pack must arm valid synthetic short return":"cart must arm valid synthetic short return");++checks;
  must(!h->consumeConstructedShortReturn(0x808108,c),"wrong target rejected");++checks;
  must(h->consumeConstructedShortReturn(0x808107,c),"verified native return consumed");++checks;
  must(h->nativeReturns.size()==1&&!h->nativeReturns.back().syntheticShortArmed,"outer native frame preserved");++checks;
  c.pb=0x81;must(!arm(),"wrong program bank rejected");++checks;c.pb=0x80;
  h->ram[0x1f1]=0x05;must(!arm(),"wrong physical stack word rejected");++checks;h->ram[0x1f1]=0x06;
  c.s--;must(!arm(),"wrong stack depth rejected");++checks;c.s++;
  if(native)h->nativeRom.regions[0].data[0x104]=0xea;else h->cart[0x104]=0xea;
  must(!arm(),"corrupt opcode rejected");++checks;
 }
 for(bool longCall:{false,true}){
  CpuState c;auto h=fixture(c,true,longCall);h->nativeRom.regions[0].data.resize(0x103);
  must(!(longCall?h->armConstructedShortReturn(0x808104,c):h->armPeaJumpShortReturn(0x808104,c)),"sparse opcode proof rejected");++checks;
 }
 std::cout<<"CONSTRUCTED_SHORT_NATIVE_ROM_REV193_PASS checks="<<checks<<" cart/native, long/short, sparse and rejection guards\n";
 return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 2;}}
