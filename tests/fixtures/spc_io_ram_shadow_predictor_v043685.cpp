#include "runtime.hpp"
#include <iostream>
#include <memory>
int main(){
 int checks=0,failures=0;
 auto check=[&](bool ok,const std::string&name){++checks;if(!ok){++failures;std::cout<<"FAIL "<<name<<'\n';}};
 for(unsigned addr=0xf0;addr<=0xff;++addr){
  auto ptr=std::make_unique<ApuBridge>();auto&a=*ptr;
  a.spc.ram[addr]=0x33;a.spc.dspAddr=0x0c;
  a.spc.timerOut[0]=7;a.spc.timerOut[1]=8;a.spc.timerOut[2]=9;
  a.spcWrite(addr,0x89);
  check(a.spc.ram[addr]==0x89,"IO backing RAM write "+std::to_string(addr));
  if(addr>=0xfd)check(a.spc.timerOut[addr-0xfd]==addr-0xfd+7,"timer output write ignored "+std::to_string(addr));
  if(addr>=0xfa&&addr<=0xfc)check(a.spcRead(addr)==0,"target remains write only "+std::to_string(addr));
 }
 // Rejected DSPDATA writes still update underlying RAM.
 {auto p=std::make_unique<ApuBridge>();auto&a=*p;a.spcWrite(0xf2,0x8c);a.spcWrite(0xf3,0x23);
 check(a.spc.ram[0xf3]==0x23,"DSPDATA rejected write shadows RAM");check(a.dsp.readReg(0x0c)==0,"DSPDATA latch remains protected");}
 // Actual MOV dp,#imm instruction must expose the same memory effect.
 {auto p=std::make_unique<ApuBridge>();auto&a=*p;a.spc.control=0;a.spc.pc=0x200;a.spc.ram[0x200]=0x8f;a.spc.ram[0x201]=0x93;a.spc.ram[0x202]=0xfd;
 a.spc.timerOut[0]=5;forja65SpcStep(a);check(a.spc.ram[0xfd]==0x93,"MOV dp immediate updates IO backing RAM");check(a.spc.timerOut[0]==5,"MOV output write does not alter timer latch");}
 // IPL overlays reads while writes always affect underlying RAM.
 {auto p=std::make_unique<ApuBridge>();auto&a=*p;a.spcWrite(0xffc0,0x42);check(a.spcRead(0xffc0)==kForja65Ipl[0],"IPL read overlay");a.spcWrite(0xf1,0);check(a.spcRead(0xffc0)==0x42,"IPL underlying RAM exposed");}
 // Predictors must use the same zero-valued write-only IO read as execution.
 for(unsigned target=0xfa;target<=0xfc;++target)for(unsigned op:{0x03u,0x13u,0x23u,0x33u,0x43u,0x53u,0x63u,0x73u,0x83u,0x93u,0xa3u,0xb3u,0xc3u,0xd3u,0xe3u,0xf3u,0x2eu,0xdeu,0x6eu}){
  auto p=std::make_unique<ApuBridge>();auto&a=*p;a.spc.control=0;a.spc.pc=0x200;a.spc.ram[0x200]=op;a.spc.ram[0x201]=target;a.spc.ram[0x202]=1;a.spc.ram[target]=0xff;
  if(op==0x6e)a.spc.ram[target]=1;
  unsigned predicted=forja65SpcPredictCycles(a),actual=forja65SpcStep(a);
  check(predicted==actual,"predictor target="+std::to_string(target)+" opcode="+std::to_string(op)+" predicted="+std::to_string(predicted)+" actual="+std::to_string(actual));
 }
 // Strict scheduler must release a five-cycle CBNE and hold a seven-cycle BBC.
 for(unsigned op:{0x2eu,0x13u}){
  auto p=std::make_unique<ApuBridge>();auto&a=*p;a.spc.control=0;a.spc.pc=0x200;
  a.spc.ram[0x200]=op;a.spc.ram[0x201]=0xfa;a.spc.ram[0x202]=1;a.spc.ram[0xfa]=0xff;
  a.tickSpcMasterCycles(105); // floor(105*1024000/21477272) == 5 SPC cycles
  check(a.spc.pc==(op==0x2e?0x203:0x200),"strict scheduler five cycle boundary opcode="+std::to_string(op));
  check(a.spcExecutedCycles==(op==0x2e?5u:0u),"strict scheduler cycle accounting opcode="+std::to_string(op));
 }
 std::cout<<"SPC_IO_SHADOW_PREDICTOR checks="<<checks<<" failures="<<failures<<'\n';return failures?1:0;
}
