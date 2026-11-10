#include "runtime.hpp"
#include <fstream>
#include <iostream>
#include <array>
#include <memory>
int main(int argc,char**argv){
 if(argc!=2)return 2;
 std::ifstream in(argv[1]);
 auto h=std::make_unique<ApuBridge>();
 h->correctedSpcSemantics=true;h->accurateSpcTiming=true;
 std::array<unsigned,256> tested{},badState{},badCycles{};
 unsigned op,id,pc,a,x,y,sp,psw,n,addr,value,expectedCost;
 unsigned total=0,stateFailures=0,cycleFailures=0;
 while(in>>op>>id>>pc>>a>>x>>y>>sp>>psw>>n){
  std::fill(h->spc.ram.begin(),h->spc.ram.end(),0);
  h->spc.pc=pc;h->spc.setA(a);h->spc.x=x;h->spc.setY(y);h->spc.sp=sp;h->spc.psw=psw;
  h->spc.control=0;h->spc.sleeping=false;h->spc.stopped=false;
  for(unsigned i=0;i<n;i++){in>>addr>>value;h->spc.ram[addr]=value;}
  in>>pc>>a>>x>>y>>sp>>psw>>expectedCost>>n;
  const unsigned actualCost=forja65SpcStep(*h);
  bool okay=h->spc.pc==pc&&h->spc.a()==a&&h->spc.x==x&&h->spc.y()==y&&h->spc.sp==sp&&h->spc.psw==psw;
  for(unsigned i=0;i<n;i++){in>>addr>>value;if(h->spc.ram[addr]!=value)okay=false;}
  if(!in){std::cerr<<"TRUNCATED_VECTOR_INPUT\n";return 2;}
  tested[op]++;total++;
  if(!okay){badState[op]++;if(stateFailures++<12)std::cerr<<"STATE_DIFF op="<<std::hex<<op<<std::dec<<" case="<<id<<" PC="<<h->spc.pc<<"/"<<pc<<" A="<<unsigned(h->spc.a())<<"/"<<a<<" PSW="<<unsigned(h->spc.psw)<<"/"<<psw<<'\n';}
  // SLEEP/STOP vectors include repeated halted read/wait pairs, not a
  // finite instruction duration. Compare their state but not prefix length.
  if(op!=0xef&&op!=0xff&&actualCost!=expectedCost){badCycles[op]++;if(cycleFailures++<12)std::cerr<<"CYCLE_DIFF op="<<std::hex<<op<<std::dec<<" case="<<id<<" actual="<<actualCost<<" expected="<<expectedCost<<'\n';}
 }
 if(!in.eof()||!total)return 2;
 for(unsigned i=0;i<256;i++)if(badState[i]||badCycles[i])std::cerr<<"OPCODE_DIFF op="<<std::hex<<i<<std::dec<<" tested="<<tested[i]<<" state="<<badState[i]<<" cycles="<<badCycles[i]<<'\n';
 unsigned covered=0;for(auto n:tested)covered+=n>0;
 std::cout<<"SPC_SINGLESTEP_V043666 cases="<<total<<" opcodes="<<covered<<" state_failures="<<stateFailures<<" cycle_failures="<<cycleFailures<<" io_cases=excluded halt_duration=excluded bus_microcycles=unmeasured\n";
 return stateFailures||cycleFailures?1:0;
}
