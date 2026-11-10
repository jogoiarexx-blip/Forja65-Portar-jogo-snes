// v0.4.36.34: real generated C++ runtime integration for RMW intermediate access.
#include "runtime.hpp"
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <cstdint>
struct Event {std::string kind, source, dummy; std::uint32_t addr, value;};
static std::vector<Event> load(const std::string& path) {
  std::ifstream f(path); std::vector<Event> events; std::string line;
  while(std::getline(f,line)) {
    if(line.empty()||line[0]=='#'||line.rfind("seq,",0)==0)continue;
    std::istringstream input(line); std::string piece; std::vector<std::string> cols;
    while(std::getline(input,piece,','))cols.push_back(piece);
    if(cols.size()!=9)throw std::runtime_error("Invalid bus trace row");
    events.push_back({cols[4],cols[5],cols[8],(std::uint32_t)std::stoul(cols[6]),(std::uint32_t)std::stoul(cols[7])});
  } return events;
}
static void runRmw(CpuState&cpu,SnesRuntime&hw,unsigned opcode,std::uint32_t address,int bits){
  switch(opcode){
    case 0:cpu.incMem(hw,address,bits);break;
    case 1:cpu.decMem(hw,address,bits);break;
    case 2:cpu.aslMem(hw,address,bits);break;
    case 3:cpu.lsrMem(hw,address,bits);break;
    case 4:cpu.rolMem(hw,address,bits);break;
    case 5:cpu.rorMem(hw,address,bits);break;
    case 6:cpu.tsb(hw,address,bits);break;
    case 7:cpu.trb(hw,address,bits);break;
  }
}
static int compare(const std::vector<Event>& rows, std::uint32_t addr,int bits,
                   std::uint32_t old,std::uint32_t updated,bool e){
  std::vector<Event> expected;
  expected.push_back({"read","CPU","false",addr,old&255u});
  const auto last=(addr+(bits==16?1u:0u))&0xffffffu;
  const auto oldLast=(bits==16?(old>>8):old)&255u;
  if(bits==16)expected.push_back({"read","CPU","false",last,oldLast});
  // S-CPU internal modify cycle does not issue an external access.
  (void)e;
  if(bits==16)expected.push_back({"write","CPU","false",last,(updated>>8)&255u});
  expected.push_back({"write","CPU","false",addr,updated&255u});
  if(expected.size()!=rows.size())return 1;
  for(std::size_t n=0;n<expected.size();n++){
    if(rows[n].kind!=expected[n].kind||rows[n].source!=expected[n].source||
       rows[n].dummy!=expected[n].dummy||rows[n].addr!=expected[n].addr||
       rows[n].value!=expected[n].value) return (int)n+2;
  } return 0;
}
int main(){
  try{
    const char* names[]={"INC","DEC","ASL","LSR","ROL","ROR","TSB","TRB"};
    const unsigned expected8[]={0x35,0x33,0x68,0x1a,0x68,0x1a,0xf4,0x04};
    const unsigned expected16[]={0x1235,0x1233,0x2468,0x091a,0x2468,0x091a,0x12f4,0x1204};
    int cases=0;
    for(bool emulation:{false,true})for(int bits:{8,16})for(unsigned opcode=0;opcode<8;opcode++){
      SnesRuntime hw;CpuState cpu;cpu.e=emulation;cpu.c=false;cpu.a=0xf0;
      constexpr std::uint32_t address=0x7e0050u;
      hw.ram[0x50]=0x34;hw.ram[0x51]=0x12;
      const std::string file="rmw34-"+std::string(emulation?"emulation-":"native-")+names[opcode]+std::to_string(bits)+".csv";
      hw.busClockTrace.start(file);
      runRmw(cpu,hw,opcode,address,bits);
      hw.busClockTrace.close();
      auto updated=(bits==8?expected8:expected16)[opcode];
      auto actual=(unsigned)hw.ram[0x50]|((bits==16?(unsigned)hw.ram[0x51]:0u)<<8);
      if(actual!=updated){std::cerr<<"Wrong resulting WRAM "<<file<<'\n';return 2;}
      if(int error=compare(load(file),address,bits,bits==8?0x34u:0x1234u,updated,emulation)){
        std::cerr<<"Trace mismatch "<<file<<" index="<<error<<'\n';return 3;
      }
      cases++;
    }
    // WRAM mirrors are eligible; IO, ROM and SRAM are excluded until peripheral tests.
    SnesRuntime hw;
    if(!hw.rmwSafeWram(0x7e0050,8)||!hw.rmwSafeWram(0x7e0050,16)||
       !hw.rmwSafeWram(0x000050,8)||!hw.rmwSafeWram(0x800050,8)||
       hw.rmwSafeWram(0x002180,8)||hw.rmwSafeWram(0x002140,8)||
       hw.rmwSafeWram(0x002100,8)||hw.rmwSafeWram(0x008000,8)||
       hw.rmwSafeWram(0x001fff,16))return 4;
    hw.busClockTrace.start("rmw34-io-guard.csv");
    hw.rmwIntermediate(0x002140,0x34,8,false);
    hw.rmwIntermediate(0x002100,0x34,8,true);
    hw.busClockTrace.close();
    if(!load("rmw34-io-guard.csv").empty())return 5;
    if(hw.io.wramPortAddr!=0)return 6;
    // A regular read and write remain unclassified; intermediate WRAM events are true.
    hw.busClockTrace.start("rmw34-general.csv");
    hw.write8(0x7e0060,0x44);hw.read(0x7e0060);
    hw.busClockTrace.close();
    auto general=load("rmw34-general.csv");
    if(general.size()!=2||general[0].dummy!="unknown"||general[1].dummy!="unknown")return 7;
    std::cout<<"FORJA65_RMW34_PASS cases="<<cases<<" io_protected=2\n";
    return 0;
  }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
