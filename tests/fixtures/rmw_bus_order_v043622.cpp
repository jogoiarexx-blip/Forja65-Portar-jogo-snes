#include "generated.hpp"
#include "ares_rmw_reference_v043622.hpp"
#include "rmw_cases.hpp"
#include <fstream>
#include <sstream>
#include <memory>
#include <iostream>
using namespace upstream_ares_rmw;
static std::vector<Event> readTrace(){std::ifstream f("rmw-native.csv");std::vector<Event> out;std::string line;while(std::getline(f,line)){std::vector<std::string> fields;std::stringstream s(line);std::string t;while(std::getline(s,t,','))fields.push_back(t);if(fields.size()==9&&(fields[4]=="read"||fields[4]=="write"))out.push_back({fields[4]=="read"?'r':'w',unsigned(std::stoul(fields[6])),unsigned(std::stoul(fields[7]))});}return out;}
static void jsonEvents(std::ostream&o,const std::vector<Event>&events){o<<'[';bool first=true;for(auto&e:events){if(!first)o<<',';first=false;o<<"{\"kind\":\""<<e.kind<<"\",\"address\":"<<e.address<<",\"value\":"<<e.value<<'}';}o<<']';}
int main(){unsigned cases=0,failures=0,stateFailures=0,memoryFailures=0,busFailures=0,portFailures=0,latchFailures=0,wordCases=0,byteCases=0,storeCases=0;std::ofstream report("rmw-results.json");report<<"{\"cases\":[";
 const unsigned values[]={0,1,0xff,0x7fff,0x8000,0xffff,0x55aa,0xaa55};
 for(const auto&p:programs)for(unsigned mode=0;mode<5;mode++)for(unsigned value:values)for(unsigned av:{0u,0xa55au})for(unsigned carry:{0u,1u})for(unsigned profile:{0u,1u}){
  auto h=std::make_unique<SnesRuntime>(),rh=std::make_unique<SnesRuntime>();h->loadCart("assets/cart-data.bin");rh->loadCart("assets/cart-data.bin");
  CpuState c;c.e=mode==4;c.m8=mode==1||mode==3||mode==4;c.x8=mode>=2;c.a=std::uint16_t(av);c.x=std::uint16_t(p.kind==1&&!c.x8&&profile?0xffe0:0x20);c.y=0x73;c.d=std::uint16_t(profile?0x30f:0x300);c.s=0x1a0;c.c=carry;c.z=!carry;c.n=carry;c.v=true;c.i=true;c.decimalMode=true;c.db=std::uint8_t(p.port?(profile?0x80:0):0x7e + profile);auto initialP=c.packP();
  AresRmwReference ref(*rh);ref.A.w=c.a;ref.D.w=c.d;ref.X.w=c.x;ref.B=c.db;ref.EF=c.e;ref.CF=c.c;ref.ZF=c.z;ref.NF=c.n;
  unsigned addr;if(p.kind<2)addr=((unsigned(c.db)<<16)+p.operand+(p.kind==1?c.x:0))&0xffffffu;else{unsigned offset=p.operand+(p.kind==3?c.x:0);addr=c.e&&(c.d&255)==0?(c.d|std::uint8_t(offset)):std::uint16_t(c.d+offset);}
  if(p.port){h->io.wramPortAddr=rh->io.wramPortAddr=profile?0x1fffe:0x1234;h->ram[h->io.wramPortAddr]=rh->ram[rh->io.wramPortAddr]=std::uint8_t(value);}else{h->write8(addr,std::uint8_t(value));rh->write8(addr,std::uint8_t(value));h->write8((addr+1)&0xffffffu,std::uint8_t(value>>8));rh->write8((addr+1)&0xffffffu,std::uint8_t(value>>8));}
  unsigned pc=p.pc|(profile?0x800000u:0);ref.pc=std::uint16_t(p.pc+1);ref.code[ref.pc]=std::uint8_t(p.operand);ref.code[std::uint16_t(ref.pc+1)]=std::uint8_t(p.operand>>8);// REV141: the independent CPU-body oracle starts after opcode fetch;
  // replay its real instruction bytes on the shared peripheral bus as well.
  const unsigned instructionSize=p.kind<2?3u:2u;
  for(unsigned k=0;k<instructionSize;++k)(void)rh->read((pc&0xff0000u)|((pc+k)&0xffffu));
  ref.run(p.op,p.kind,!c.m8,p.store);
  const auto bodyMdr=rh->cpuDataBus;
  // Dispatcher fixture terminates with a real STP; its opcode also drives MDR.
  (void)rh->read((pc&0xff0000u)|((pc+instructionSize)&0xffffu));
  h->io.memsel=profile;h->trace.start("rmw-native.csv",h->cartHashHex(),1000);forja65_dispatch(c,*h,pc,0);h->trace.close();auto observed=readTrace();
  unsigned expectedP=(initialP&~0x83u)|(ref.CF?1u:0)|(ref.ZF?2u:0)|(ref.NF?0x80u:0);
  bool state=c.packP()==expectedP&&c.a==av&&c.x==ref.X.w&&c.y==0x73&&c.d==ref.D.w&&c.s==0x1a0&&c.db==ref.B&&c.pb==(profile?0x80:0)&&c.e==(mode==4)&&c.m8==(mode==1||mode==3||mode==4)&&c.x8==(mode>=2)&&h->stopped&&h->nativeReturns.empty();
  bool memory=h->ram==rh->ram,bus=observed==ref.events,port=h->io.wramPortAddr==rh->io.wramPortAddr,latch=h->testRmwMdrCaptured&&h->testRmwMdrBeforeStop==bodyMdr&&h->cpuDataBus==rh->cpuDataBus;
  if(cases==0){std::filesystem::copy_file("rmw-native.csv","first-rmw-native.csv",std::filesystem::copy_options::overwrite_existing);std::ofstream f("first-rmw-reference.csv");f<<"kind,address,value\n";for(auto&e:ref.events)f<<e.kind<<','<<e.address<<','<<e.value<<'\n';}
  if(cases++)report<<',';bool passed=state&&memory&&bus&&port&&latch;failures+=!passed;stateFailures+=!state;memoryFailures+=!memory;busFailures+=!bus;portFailures+=!port;latchFailures+=!latch;if(p.store)storeCases++;else if(c.m8)byteCases++;else wordCases++;
  report<<"{\"pc\":"<<pc<<",\"opcode\":"<<p.opcode<<",\"mode\":"<<mode<<",\"value\":"<<value<<",\"a\":"<<av<<",\"carry\":"<<carry<<",\"profile\":"<<profile<<",\"store_control\":"<<(p.store?"true":"false")<<",\"port_case\":"<<(p.port?"true":"false")<<",\"passed\":"<<(passed?"true":"false")<<",\"state\":"<<(state?"true":"false")<<",\"memory\":"<<(memory?"true":"false")<<",\"bus\":"<<(bus?"true":"false")<<",\"port\":"<<(port?"true":"false")<<",\"bus_latch\":"<<(latch?"true":"false")<<'}';
  if(!passed&&failures<=3){std::cerr<<"RMW_DIFFERENCE pc="<<std::hex<<pc<<" opcode="<<p.opcode<<std::dec<<" width="<<(c.m8?8:16)<<" memory="<<memory<<" port="<<h->io.wramPortAddr<<" expected="<<rh->io.wramPortAddr<<" observed=";jsonEvents(std::cerr,observed);std::cerr<<" reference=";jsonEvents(std::cerr,ref.events);std::cerr<<'\n';}
 }
 report<<"],\"total\":"<<cases<<",\"differences\":"<<failures<<",\"state_failures\":"<<stateFailures<<",\"memory_failures\":"<<memoryFailures<<",\"bus_failures\":"<<busFailures<<",\"port_failures\":"<<portFailures<<",\"bus_latch_failures\":"<<latchFailures<<",\"rmw_word_cases\":"<<wordCases<<",\"rmw_byte_cases\":"<<byteCases<<",\"sta_control_cases\":"<<storeCases<<",\"peripheral_runtime_shared\":true,\"cycle_equivalence_verified\":false,\"emulation_dummy_write_verified\":false,\"gameplay_verified\":false}\n";
 std::cout<<"RMW_V043622_"<<(failures?"FAIL":"PASS")<<" cases="<<cases<<" differences="<<failures<<" state="<<stateFailures<<" memory="<<memoryFailures<<" bus="<<busFailures<<" port="<<portFailures<<" latch="<<latchFailures<<'\n';return failures?1:0;
}
