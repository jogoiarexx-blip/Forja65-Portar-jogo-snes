// v0.4.36.35 - WRAM port RMW real C++ runtime side-effect regression.
#include "runtime.hpp"
#include <cstdint>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
struct Event {std::string kind,src,dummy; unsigned addr,value;};
static std::vector<Event> load(const std::string& file){
  std::ifstream in(file);std::vector<Event> out;std::string line;
  while(std::getline(in,line)){
    if(line.empty()||line[0]=='#'||line.rfind("seq,",0)==0)continue;
    std::istringstream row(line);std::string field;std::vector<std::string> cols;
    while(std::getline(row,field,','))cols.push_back(field);
    if(cols.size()!=9)throw std::runtime_error("bad bus trace CSV cols="+std::to_string(cols.size())+" line="+line);
    out.push_back({cols[4],cols[5],cols[8],(unsigned)std::stoul(cols[6]),(unsigned)std::stoul(cols[7])});
  }return out;
}
static void check(bool ok,const std::string& label){if(!ok)throw std::runtime_error(label);}
static unsigned result(unsigned opcode,unsigned old){switch(opcode){
  case 0:return (old+1)&255;case 1:return (old-1)&255;
  case 2:return (old<<1)&255;case 3:return (old>>1)&255;
  case 4:return (old<<1)&255;case 5:return (old>>1)&255;
  case 6:return old|0xF0;case 7:return old&0x0F;
}return 0;}
static void run(CpuState&cpu,SnesRuntime&hw,unsigned opcode,unsigned addr){
  switch(opcode){
    case 0:cpu.incMem(hw,addr,8);break;case 1:cpu.decMem(hw,addr,8);break;
    case 2:cpu.aslMem(hw,addr,8);break;case 3:cpu.lsrMem(hw,addr,8);break;
    case 4:cpu.rolMem(hw,addr,8);break;case 5:cpu.rorMem(hw,addr,8);break;
    case 6:cpu.tsb(hw,addr,8);break;case 7:cpu.trb(hw,addr,8);break;
  }
}
int main(){try{
  constexpr unsigned ports[]={0x002180,0x3f2180,0x802180,0xbf2180};
  constexpr const char* names[]={"INC","DEC","ASL","LSR","ROL","ROR","TSB","TRB"};
  unsigned cases=0;
  for(unsigned bank=0;bank<4;bank++)for(bool emulation:{false,true})for(unsigned opcode=0;opcode<8;opcode++){
    SnesRuntime hw;CpuState cpu;cpu.e=emulation;cpu.c=false;cpu.a=0xF0;
    constexpr unsigned base=0x1fffe,old=0x34,other=0x98;
    hw.io.wramPortAddr=base;hw.ram[base]=old;hw.ram[base+1]=other;hw.ram[0]=0x55;
    const std::string file=std::string("rmw35-")+std::to_string(bank)+(emulation?"-e-":"-n-")+names[opcode]+".csv";
    check(hw.rmwSafeWramPort(ports[bank],8),"WRAM port mirror not recognized");
    hw.busClockTrace.start(file);run(cpu,hw,opcode,ports[bank]);hw.busClockTrace.close();
    const auto events=load(file);
    check(events.size()==2,file+": expected read + final write; modify cycle is internal");
    check(events[0].kind=="read"&&events[0].src=="CPU"&&events[0].dummy=="false"&&events[0].addr==ports[bank]&&events[0].value==old,file+": first read");
    check(events[1].kind=="write"&&events[1].src=="CPU"&&events[1].dummy=="false"&&events[1].addr==ports[bank]&&events[1].value==result(opcode,old),file+": final write");
    check(hw.io.wramPortAddr==0,file+": WRAM port increments and 17-bit wraps");
    check(hw.ram[base]==old,file+": original byte intact");
    check(hw.ram[base+1]==result(opcode,old),file+": final write at next port address");
    check(hw.ram[0]==0x55,file+": internal modify cycle must not write at wrapped address");
    cases++;
  }
  // Reject 16-bit operations and unvalidated PPU, APU, timer, DMA, input
  // registers (all may have read-to-clear or write-to-trigger effects).
  SnesRuntime hw;
  for(unsigned addr:{0x002100u,0x002140u,0x004016u,0x00420bu,0x004300u,0x7e2180u}){
    check(!hw.rmwSafeWramPort(addr,8),"unsafe register was allowed");
  }
  check(!hw.rmwSafeWramPort(0x002180,16),"16-bit port not guarded");
  hw.io.wramPortAddr=0x1234;hw.ram[0x1234]=0x47;hw.busClockTrace.start("rmw35-unsafe-guard.csv");
  for(unsigned a:{0x002100u,0x002140u,0x004212u,0x00420bu,0x004300u}){
    hw.rmwIntermediate(a,0x34,8,true);hw.rmwIntermediate(a,0x34,8,false);
  }
  hw.rmwIntermediate(0x002180,0x34,16,true);
  hw.busClockTrace.close();
  check(load("rmw35-unsafe-guard.csv").empty(),"unsafe I/O intermediate trace emitted");
  check(hw.io.wramPortAddr==0x1234 && hw.ram[0x1234]==0x47,"unsafe I/O mutated port");
  std::cout<<"FORJA65_RMW35_PASS cases="<<cases<<" guards=7\n";
  return 0;
}catch(const std::exception& e){std::cerr<<"FORJA65_RMW35_FAIL "<<e.what()<<'\n';return 1;}}
