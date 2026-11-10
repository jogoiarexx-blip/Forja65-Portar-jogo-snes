// v0.4.36.36: generated-runtime end-to-end RMW read-to-clear status tests.
#include "runtime.hpp"
#include <cstdint>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

struct Event {std::string kind, src, dummy; unsigned addr, value;};
static std::vector<Event> load(const std::string& path) {
  std::ifstream in(path);std::vector<Event> result;std::string line;
  while(std::getline(in,line)){
    if(line.empty() || line[0]=='#' || line.rfind("seq,",0)==0)continue;
    std::istringstream row(line);std::string f;std::vector<std::string> c;
    while(std::getline(row,f,','))c.push_back(f);
    if(c.size()!=9)throw std::runtime_error("invalid bus CSV "+line);
    result.push_back({c[4],c[5],c[8],(unsigned)std::stoul(c[6]),(unsigned)std::stoul(c[7])});
  }
  return result;
}
static void check(bool ok,const std::string& msg){if(!ok)throw std::runtime_error(msg);}
static void run(CpuState& cpu,SnesRuntime& hw,unsigned op,unsigned address){
  switch(op){
    case 0:cpu.incMem(hw,address,8);break;
    case 1:cpu.decMem(hw,address,8);break;
    case 2:cpu.aslMem(hw,address,8);break;
    case 3:cpu.lsrMem(hw,address,8);break;
    case 4:cpu.rolMem(hw,address,8);break;
    case 5:cpu.rorMem(hw,address,8);break;
    case 6:cpu.tsb(hw,address,8);break;
    case 7:cpu.trb(hw,address,8);break;
    default:throw std::runtime_error("invalid opcode");
  }
}
static unsigned finalValue(unsigned opcode,unsigned reg){
  const unsigned oldValue=reg==0x4210u?0x82u:0x80u;
  switch(opcode){case 0:return (oldValue+1u)&0xffu;case 1:return (oldValue-1u)&0xffu;
    case 2:case 4:return (oldValue<<1)&0xffu;
    case 3:case 5:return oldValue>>1;
    case 6:return oldValue|0xf0u;case 7:return oldValue&~0xf0u;}
  return 0;
}

int main(){try{
  constexpr unsigned banks[]={0x000000u,0x3f0000u,0x800000u,0xbf0000u};
  constexpr const char* names[]={"INC","DEC","ASL","LSR","ROL","ROR","TSB","TRB"};
  unsigned cases=0;
  for(unsigned bank:banks)for(unsigned reg:{0x4210u,0x4211u})
  for(bool emulation:{false,true})for(unsigned opcode=0;opcode<8;opcode++){
    SnesRuntime hw;CpuState cpu;cpu.e=emulation;cpu.c=false;cpu.a=0xf0u;
    hw.io.nmiPending=true;hw.io.irqPending=true;
    hw.cpuNmiInterruptPending=true;hw.cpuIrqInterruptPending=true;
    const unsigned addr=bank|reg;
    check(hw.rmwSafeInterruptStatus(addr,8),"missing status mirror allowlist");
    const std::string file="rmw36-"+std::to_string(bank)+"-"+std::to_string(reg)
      +(emulation?"-emulation-":"-native-")+names[opcode]+".csv";
    hw.busClockTrace.start(file);run(cpu,hw,opcode,addr);hw.busClockTrace.close();
    const auto rows=load(file);
    check(rows.size()==2,file+": expected read + final write, internal modify cycle");
    check(rows[0].kind=="read"&&rows[0].src=="CPU"&&rows[0].dummy=="false"
       &&rows[0].addr==addr&&rows[0].value==(reg==0x4210u?0x82u:0x80u),file+": original read");
    check(rows[1].kind=="write"&&rows[1].src=="CPU"&&rows[1].dummy=="false"
       &&rows[1].addr==addr&&rows[1].value==finalValue(opcode,reg),file+": final write");
    check(hw.io.nmiPending==(reg!=0x4210u) && hw.io.irqPending==(reg!=0x4211u),file+": wrong flag clear/isolation");
    check(hw.cpuIrqInterruptPending==(reg!=0x4211u),file+": IRQ line isolation");
    // Reading RDNMI acknowledges its external flag, not the CPU's latched NMI edge.
    check(hw.cpuNmiInterruptPending,file+": latched CPU NMI edge was cleared");
    check((hw.read(addr)&0x80u)==0,file+": read-only status unexpectedly mutated by RMW writes");
    check((hw.read(reg==0x4210u?0x4211u:0x4210u)&0x80u)==0x80u,file+": unrelated status flag was cleared");
    cases++;
  }
  // The two read-to-clear registers are *only* allowlisted for 8-bit RMW.
  SnesRuntime hw;
  for(unsigned addr:{0x004210u,0x004211u})
    check(!hw.rmwSafeInterruptStatus(addr,16),"16-bit status RMW must be blocked");
  for(unsigned addr:{0x002100u,0x002140u,0x004212u,0x00420bu,0x004300u,
                     0x7e4210u,0x7e4211u,0x404210u})
    check(!hw.rmwSafeInterruptStatus(addr,8),"unsafe I/O wrongly allowlisted");
  hw.io.nmiPending=true;hw.io.irqPending=true;
  hw.busClockTrace.start("rmw36-guards.csv");
  for(unsigned addr:{0x004212u,0x00420bu,0x002140u,0x002100u}){
    hw.rmwIntermediate(addr,0x80,8,false);hw.rmwIntermediate(addr,0x80,8,true);
  }
  hw.rmwIntermediate(0x004210,0x0080,16,false);
  hw.rmwIntermediate(0x004211,0x0080,16,true);
  hw.busClockTrace.close();
  check(load("rmw36-guards.csv").empty(),"guard emitted forbidden bus accesses");
  check(hw.io.nmiPending&&hw.io.irqPending,"guard mutated interrupt flags");
  std::cout<<"FORJA65_RMW36_PASS cases="<<cases<<" guards=10\n";
  return 0;
}catch(const std::exception& e){std::cerr<<"FORJA65_RMW36_FAIL "<<e.what()<<'\n';return 1;}}
