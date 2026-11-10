#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <fstream>
#include <iostream>
#include <memory>
#include <cstdio>
static void env(const char* k,const char* v){
#ifdef _WIN32
 _putenv_s(k,v);
#else
 setenv(k,v,1);
#endif
}
int main(){
 auto ptr=std::make_unique<SnesRuntime>(); auto& hw=*ptr;
 hw.ram[0x10]=0x35;
 hw.appendWramDeltaSnapshot(); assert(hw.ram[0x10]==0x35);
 env("FORJA65_WRAM_DELTA_CSV",".");
 try{hw.appendWramDeltaSnapshot();}catch(const std::exception& e){
  std::cerr<<"WRAM_INVALID_PATH_ABORT: "<<e.what()<<"\n";return 1;
 }
 assert(hw.wramDeltaPrevious==hw.ram);
 hw.wramDeltaPrevious.clear();
 env("FORJA65_WRAM_DELTA_CSV","wram-merge-smoke.csv");
 env("FORJA65_WRAM_DELTA_LIMIT","1");
 hw.appendWramDeltaSnapshot();hw.frameCounter++;
 hw.ram[0x10]=0x76;hw.ram[0x11]=0x91;hw.appendWramDeltaSnapshot();
 assert(hw.ram[0x10]==0x76&&hw.ram[0x11]==0x91);
 std::ifstream input("wram-merge-smoke.csv");std::string text((std::istreambuf_iterator<char>(input)),{});
 assert(text.find("0,,,,0,0,1")!=std::string::npos);
 assert(text.find("1,7e0010,35,76,2,1,0")!=std::string::npos);
 assert(text.find("7e0011")==std::string::npos);
 env("FORJA65_WRAM_DELTA_CSV","");
 input.close();std::remove("wram-merge-smoke.csv");
 std::cout<<"WRAM_RUNTIME_MERGE_PASS baseline=1 shown=1 changed=2 read_only=yes\n";
}
