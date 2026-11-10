#include "runtime.hpp"
#include <iostream>
static unsigned hostBody(CpuState&c,SnesRuntime&h){c.setA(7,8);h.ram[0x10]=7;return 20;}
int main(){try{
  SnesRuntime hw;hw.cart.resize(0x8000);hw.romLogicalSize=hw.cart.size();CpuState cpu;
  hw.registerNativeHook({0x8020,hostBody,nullptr,1,1,1});cpu.push16Value(hw,0x8002);hw.pushNativeReturn(0x8003,false);cpu.pb=0;
  if(!hw.runNativeHook(0x8020,cpu)||cpu.s!=0x1ff||cpu.a!=7||hw.ram[0x10]!=7||!hw.nativeReturns.empty())return 3;
  ForjaIR::setPalette(0,{0x1f,0x3e0}).apply(hw.hostRenderer);ForjaIR::setScroll(1,5,-7).apply(hw.hostRenderer);
  if(hw.hostRenderer.palette[0]!=0x1f||hw.hostRenderer.layers[1].y!=-7)return 4;
  bool rejected=false;try{ForjaIR::setPalette(255,{1,2}).apply(hw.hostRenderer);}catch(const std::out_of_range&){rejected=true;}if(!rejected)return 5;
  hw.io.nmiPending=true;if(hw.read(0x4210)!=0x82||hw.io.nmiPending)return 6;
  std::cout<<"FORJA65_FRAMEWORK_SMOKE_PASS\n";return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 2;}}
