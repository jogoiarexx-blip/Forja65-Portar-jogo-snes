#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <memory>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <chrono>
static void env(const char* k,const char* v){
#ifdef _WIN32
 _putenv_s(k,v);
#else
 setenv(k,v,1);
#endif
}
static std::string read(const char* p){std::ifstream f(p);return std::string((std::istreambuf_iterator<char>(f)),{});}
struct OwnedTestDirectory {
 std::filesystem::path previous,temporary;
 OwnedTestDirectory():previous(std::filesystem::current_path()){
  const auto nonce=std::to_string(std::chrono::steady_clock::now().time_since_epoch().count());
  for(unsigned attempt=0;;++attempt){
   temporary=std::filesystem::temp_directory_path()/("forja65-wram-v027-"+nonce+"-"+std::to_string(attempt));
   if(std::filesystem::create_directory(temporary))break;
  }
  std::filesystem::current_path(temporary);
 }
 ~OwnedTestDirectory(){std::error_code error;std::filesystem::current_path(previous,error);std::filesystem::remove_all(temporary,error);}
};
int main(){
 OwnedTestDirectory working;
 env("FORJA65_WRAM_WRITE_START","0");env("FORJA65_WRAM_WRITE_END","100");
 env("FORJA65_WRAM_DIFF_START","0");env("FORJA65_WRAM_DIFF_END","100");env("FORJA65_WRAM_DIFF_STEP","1");
 auto state=std::make_unique<SnesRuntime>();auto& hw=*state;
 env("FORJA65_WRAM_WRITE_CSV","writers.csv");env("FORJA65_WRAM_WRITE_ADDRS","");
 hw.write8(0x7e0010,8);assert(!std::filesystem::exists("writers.csv"));
 env("FORJA65_WRAM_WRITE_ADDRS","7E0010,7E0011,0012");env("FORJA65_WRAM_WRITE_MAX","3");
 env("FORJA65_WRAM_WRITE_START","10");env("FORJA65_WRAM_WRITE_END","10");
 hw.frameCounter=9;hw.write8(0x7e0010,8);assert(!std::filesystem::exists("writers.csv"));
 hw.frameCounter=10;hw.lastInstructionPc=0xc0f923;hw.io.joy[0]=256;hw.nmiServiceCount=5;
 auto clock=hw.cpuMasterClock;
 hw.write8(0x000010,3); // mirrored WRAM write
 hw.io.wramPortAddr=0x11;hw.write8(0x2180,2); // data port
 hw.io.wramPortAddr=0x12;assert(hw.nativeBbusWrite(0x2180,1)); // native DMA/B-bus port
 hw.write8(0x7e0010,0); // value changes even after observer cap
 assert(hw.ram[0x10]==0&&hw.ram[0x11]==2&&hw.ram[0x12]==1);
 assert(hw.cpuMasterClock==clock&&hw.wramWriteTraceCount==3);
 auto writes=read("writers.csv");
 assert(writes.find("frame,address,old,new,writer_pc,bus,joy1,nmi\n")!=std::string::npos);
 assert(writes.find("10,7E0010,8,3,C0F923,bus,256,5\n")!=std::string::npos);
 assert(writes.find("10,7E0011,0,2,C0F923,2180,256,5\n")!=std::string::npos);
 assert(writes.find("10,7E0012,0,1,C0F923,2180,256,5\n")!=std::string::npos);
 env("FORJA65_WRAM_WRITE_MAX","10");hw.frameCounter=11;
 hw.write8(0x7e0010,6);assert(read("writers.csv")==writes&&hw.wramWriteTraceCount==3);
 hw.frameCounter=10;env("FORJA65_WRAM_WRITE_CSV",".");
 hw.write8(0x7e0010,9);assert(hw.ram[0x10]==9); // bad path must remain passive
 env("FORJA65_WRAM_WRITE_CSV","");
 env("FORJA65_WRAM_DIFF_CSV","diff.csv");env("FORJA65_WRAM_DIFF_MAX_EVENTS","2");env("FORJA65_WRAM_DIFF_MAX_PER_FRAME","1");
 hw.frameCounter=0;hw.appendWramDiffSnapshot();
 hw.frameCounter=1;hw.ram[0x20]=1;hw.ram[0x21]=2;hw.appendWramDiffSnapshot();
 hw.frameCounter=2;hw.ram[0x20]=3;hw.appendWramDiffSnapshot();
 hw.frameCounter=3;hw.ram[0x20]=4;hw.ram[0x21]=5;hw.appendWramDiffSnapshot();
 auto diff=read("diff.csv");
 assert(diff.find("kind,frame,wram_address,old_value,new_value,changed,emitted,truncated,joy1,nmi,pc\n")!=std::string::npos);
 assert(diff.find("baseline,0,,,,0,0,0,256,5,12646691\n")!=std::string::npos);
 assert(diff.find("summary,1,,,,2,1,1,256,5,12646691\n")!=std::string::npos);
 assert(diff.find("summary,2,,,,1,1,0,256,5,12646691\n")!=std::string::npos);
 assert(diff.find("summary,3,,,,2,0,2,256,5,12646691\n")!=std::string::npos);
 assert(hw.wramDiffPrevious==hw.ram&&hw.wramDiffEmitted==2&&hw.cpuMasterClock==clock);
 env("FORJA65_WRAM_DIFF_CSV",".");hw.appendWramDiffSnapshot();
 env("FORJA65_WRAM_DIFF_CSV","window.csv");env("FORJA65_WRAM_DIFF_START","2");env("FORJA65_WRAM_DIFF_END","4");env("FORJA65_WRAM_DIFF_STEP","2");
 auto window=std::make_unique<SnesRuntime>();
 window->frameCounter=1;window->ram[0x30]=1;window->appendWramDiffSnapshot();assert(!std::filesystem::exists("window.csv"));
 window->frameCounter=2;window->appendWramDiffSnapshot();
 window->frameCounter=3;window->ram[0x30]=2;window->appendWramDiffSnapshot();auto before=read("window.csv");
 assert(before.find("delta,")==std::string::npos);
 window->frameCounter=4;window->ram[0x30]=3;window->appendWramDiffSnapshot();
 assert(read("window.csv").find("delta,4,7E0030,1,3,")!=std::string::npos);
 window->frameCounter=5;window->ram[0x30]=4;auto after=read("window.csv");window->appendWramDiffSnapshot();assert(read("window.csv")==after);
 env("FORJA65_WRAM_DIFF_CSV","");
 std::cout<<"WRAM_WRITER_DIFF_V027_PASS channels=3 writer_pc=recorded cap=3 diff_cap=2 truncation=explicit clock=unchanged bad_path=passive windows=checked repeat=isolated\n";
}
