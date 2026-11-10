#include "runtime.hpp"
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <cstdint>

struct Event {std::string kind, source, dummy; std::uint32_t addr, value;};
static std::vector<Event> load(const std::string& path) {
  std::ifstream f(path);
  std::vector<Event> events;
  std::string line;
  while(std::getline(f,line)) {
    if(line.empty()||line[0]=='#'||line.rfind("seq,",0)==0) continue;
    std::istringstream input(line);
    std::string part;
    std::vector<std::string> p;
    while(std::getline(input,part,',')) p.push_back(part);
    if(p.size()!=9) throw std::runtime_error("Unexpected bus trace columns");
    events.push_back({p[4],p[5],p[8],(std::uint32_t)std::stoul(p[6]),(std::uint32_t)std::stoul(p[7])});
  }
  return events;
}
static int check(const std::vector<Event>& events, std::uint32_t address,
                 int bits, std::uint32_t original, std::uint32_t updated) {
  std::vector<Event> expected;
  expected.push_back({"read","CPU","false",address,original&255u});
  if(bits==16) expected.push_back({"read","CPU","false",address+1u,(original>>8)&255u});
  // S-CPU modify cycle is internal; no old-value write reaches WRAM.
  if(bits==16) expected.push_back({"write","CPU","false",address+1u,(updated>>8)&255u});
  expected.push_back({"write","CPU","false",address,updated&255u});
  if(events.size()!=expected.size()) return 1;
  for(std::size_t i=0;i<events.size();++i) {
    if(events[i].kind!=expected[i].kind||events[i].source!=expected[i].source||
       events[i].dummy!=expected[i].dummy||events[i].addr!=expected[i].addr||
       events[i].value!=expected[i].value) return (int)i+2;
  }
  return 0;
}
int main() {
  try {
    constexpr std::uint32_t address=0x7e0050u;
    const char* names[]={"INC","DEC","ASL","LSR","ROL","ROR","TSB","TRB"};
    const unsigned expected8[]={0x35,0x33,0x68,0x1a,0x68,0x1a,0xf4,0x04};
    const unsigned expected16[]={0x1235,0x1233,0x2468,0x091a,0x2468,0x091a,0x12f4,0x1204};
    for(int bits: {8,16}) {
      for(int which=0;which<8;which++) {
        SnesRuntime hw;
        CpuState cpu;
        cpu.c=false;cpu.a=0x00f0;
        hw.ram[0x50]=0x34;hw.ram[0x51]=0x12;
        hw.lastInstructionPc=0x808000u+(std::uint32_t)which;
        const std::string path=std::string("rmw-")+names[which]+std::to_string(bits)+".csv";
        hw.busClockTrace.start(path);
        switch(which) {
          case 0:cpu.incMem(hw,address,bits);break;
          case 1:cpu.decMem(hw,address,bits);break;
          case 2:cpu.aslMem(hw,address,bits);break;
          case 3:cpu.lsrMem(hw,address,bits);break;
          case 4:cpu.rolMem(hw,address,bits);break;
          case 5:cpu.rorMem(hw,address,bits);break;
          case 6:cpu.tsb(hw,address,bits);break;
          case 7:cpu.trb(hw,address,bits);break;
        }
        hw.busClockTrace.close();
        const auto wanted=bits==8?expected8[which]:expected16[which];
        const auto actual=(unsigned)hw.ram[0x50]|((bits==16?(unsigned)hw.ram[0x51]:0u)<<8);
        if(actual!=wanted) {std::cerr<<"State mismatch "<<names[which]<<bits<<'\n';return 2;}
        const auto events=load(path);
        const int diff=check(events,address,bits,bits==8?0x34:0x1234,wanted);
        if(diff){std::cerr<<"Trace mismatch "<<names[which]<<bits<<" code="<<diff<<'\n';return 3;}
      }
    }
    // Generic bus accesses remain unknown: never guess dummy status.
    SnesRuntime hw;
    hw.busClockTrace.start("general.csv");
    hw.write8(address,0x44);
    hw.read(address);
    hw.busClockTrace.close();
    const auto other=load("general.csv");
    if(other.size()!=2||other[0].dummy!="unknown"||other[1].dummy!="unknown")return 4;
    std::cout<<"FORJA65_RMW_TRACE_PASS cases=16 rmw_events=64 general_unknown=2\n";
    return 0;
  } catch(const std::exception& ex){std::cerr<<ex.what()<<'\n';return 1;}
}
