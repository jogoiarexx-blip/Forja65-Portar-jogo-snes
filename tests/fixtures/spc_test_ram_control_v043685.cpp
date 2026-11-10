#include "runtime.hpp"
#include <iostream>
#include <memory>
int main(){int checks=0,failures=0;auto check=[&](bool ok,const char*n){++checks;if(!ok){++failures;std::cout<<"FAIL "<<n<<'\n';}};
 for(unsigned mode:{0x08u,0x0cu,0x0eu}){
  auto p=std::make_unique<ApuBridge>();auto&a=*p;a.spc.ram[0x1234]=0x31;a.spc.ram[0xf2]=0x27;a.spc.ram[0xf4]=0x28;a.spc.ram[0xf8]=0x43;a.spc.ram[0xf9]=0x44;
  a.spcWrite(0xf8,0x43);a.spcWrite(0xf9,0x44);a.spcWrite(0xf0,mode);
  a.spcWrite(0x1234,0x92);a.spcWrite(0xf2,0x8c);a.spcWrite(0xf8,0x71);a.spcWrite(0xf9,0x72);
  check(a.spc.ram[0x1234]==0x31,"TEST protects ordinary backing RAM");
  check(a.spc.ram[0xf2]==0x27,"TEST protects IO backing RAM");
  a.spcWrite(0xf4,0x87);a.spcWrite(0xfa,0x91);a.spc.timerOut[0]=7;
  check(a.spc.ram[0xf4]==0x28,"TEST protects port backing RAM");
  check(a.spc.portOut[0]==0x87,"Port output latch still writable");
  check(a.spc.timerTarget[0]==0x91&&a.spcRead(0xfa)==0,"Timer target still writable and read zero");
  check(a.spcRead(0xfd)==7&&a.spcRead(0xfd)==0,"Timer latch remains read to clear");
  check(a.spcRead(0xf2)==0x8c,"IO register remains writable and readable");
  check(a.spc.ram[0xf8]==0x43&&a.spc.ram[0xf9]==0x44,"TEST protects AUX backing RAM");
  check(a.spcRead(0xf8)==0x71&&a.spcRead(0xf9)==0x72,"AUX latches remain writable and readable");
  check(a.spcRead(0x1234)==((mode&4)?0x5a:0x31),"TEST ordinary read disable");
  check(forja65SpcPeek(a,0x1234)==((mode&4)?0x5a:0x31),"TEST predictor ordinary read disable");
  check(forja65SpcPeek(a,0xf8)==0x71&&forja65SpcPeek(a,0xf9)==0x72,"TEST predictor AUX latches");
  check(a.spcRead(0xffc0)==kForja65Ipl[0],"IPL overlay takes priority over RAM disable");
  a.spcWrite(0xf1,0);check(a.spcRead(0xffc0)==((mode&4)?0x5a:0),"RAM disable below IPL overlay");
  a.spcWrite(0xf0,0x0a);a.spcWrite(0x1234,0x92);check(a.spcRead(0x1234)==0x92,"TEST restores RAM read/write");
  check(a.spcRead(0xf0)==0,"TEST remains write only");
 }
 {auto p=std::make_unique<ApuBridge>();auto&a=*p;a.spc.psw=CP;a.spcWrite(0xf0,0x0e);a.spcWrite(0x1234,0x92);check(a.spcRead(0x1234)==0x92,"P set prevents TEST update");check(a.spc.ram[0xf0]==0x0e,"P set TEST write still reaches backing RAM");}
 {auto p=std::make_unique<ApuBridge>();auto&a=*p;a.spcWrite(0xf0,0x0e);a.spc.psw=CP;a.spcWrite(0xf0,0x0a);check(a.spcRead(0x1234)==0x5a,"P set prevents TEST restore");a.spc.psw=0;a.spcWrite(0xf0,0x0a);check(a.spcRead(0x1234)==0,"P clear restores TEST");}
 std::cout<<"SPC_TEST_RAM checks="<<checks<<" failures="<<failures<<'\n';return failures?1:0;}
