#include "runtime.hpp"
#include <iostream>
#include <functional>
static void check(bool v,const char*m){if(!v)throw std::runtime_error(m);}
static void trace(const std::string& data){std::ofstream("logic.txt")<<data;}
static void env(const char*k,const char*v){
#ifdef _WIN32
 _putenv_s(k,v?v:"");
#else
 if(v)setenv(k,v,1);else unsetenv(k);
#endif
}
int main(){
 std::cout.setf(std::ios::unitbuf);unsigned failed=0;
 auto test=[&](const std::string&name,std::function<void()> f){
 env("FORJA65_INPUT_LOGIC_ADDR",nullptr);env("FORJA65_INPUT_LOGIC_SPACE",nullptr);env("FORJA65_INPUT_LOGIC_WALL_OUT",nullptr);
 try{f();std::cout<<"PASS "<<name<<"\n";}catch(const std::exception&e){++failed;std::cerr<<"FAIL "<<name<<": "<<e.what()<<"\n";}};
 auto make=[](){return std::make_unique<SnesRuntime>("assets/cart-data.bin",MapperKind::LoROM,128,5,0,CartChip::None,"save.srm",1,true);};
 test("paired RLE, lag hold, counter wrap, pad2-only wall changes, EOF",[&]{
 auto h=make();trace("# FORJA65_LOGIC_TRACE 1 addr=13 space=BWRAM\n0010/0020*2 0010/0040 0080\n");env("FORJA65_INPUT_LOGIC_WALL_OUT","wall.txt");h->loadLogicReplay("logic.txt");
 h->sram[0x13]=255;h->logicReplayAtVblank();check(h->io.joy[0]==16&&h->io.joy[1]==32,"initial pair");
 h->ram[0x13]=1;h->frameCounter=1;h->logicReplayAtVblank();check(h->logicPos==0&&h->io.joy[1]==32,"WRAM altered BWRAM replay");
 h->sram[0x13]=0;h->frameCounter=2;h->logicReplayAtVblank();check(h->logicPos==1&&h->io.joy[1]==32,"wrap / RLE");
 h->sram[0x13]=1;h->frameCounter=3;h->logicReplayAtVblank();check(h->io.joy[0]==16&&h->io.joy[1]==64,"pad2-only transition");
 h->sram[0x13]=2;h->frameCounter=4;h->logicReplayAtVblank();check(h->io.joy[0]==128&&h->io.joy[1]==0,"legacy zero pad2");
 h->sram[0x13]=3;h->frameCounter=5;h->logicReplayAtVblank();check(h->io.joy[0]==0&&h->io.joy[1]==0,"EOF release");
 std::ifstream in("wall.txt");std::string w((std::istreambuf_iterator<char>(in)),{});
 check(w.find("frame=0 joy1=0010 joy2=0020")!=std::string::npos,"wall first pair");check(w.find("frame=3 joy1=0010 joy2=0040")!=std::string::npos,"wall pad2-only change");check(w.find("frame=1 ")==std::string::npos&&w.find("frame=2 ")==std::string::npos,"duplicate wall hold");});
 test("legacy WRAM defaults",[&]{auto h=make();trace("# FORJA65_LOGIC_TRACE 1 addr=13\n0010*2 0020\n");h->loadLogicReplay("logic.txt");h->logicReplayAtVblank();h->sram[19]=1;h->logicReplayAtVblank();check(h->logicPos==0,"legacy SRAM");h->ram[19]=1;h->logicReplayAtVblank();check(h->logicPos==1&&h->io.joy[0]==16&&h->io.joy[1]==0,"legacy RLE");});
 test("env overrides space and address",[&]{auto h=make();trace("# FORJA65_LOGIC_TRACE 1 addr=13 space=WRAM\n0001 0002\n");env("FORJA65_INPUT_LOGIC_SPACE","BWRAM");env("FORJA65_INPUT_LOGIC_ADDR","12");h->loadLogicReplay("logic.txt");h->sram[18]=0;h->logicReplayAtVblank();h->sram[18]=1;h->logicReplayAtVblank();check(h->logicPos==1&&h->io.joy[0]==2,"override ignored");});
 for(const std::string token:{"0001/","/0002","0001/0002/0003","0001/10000","10000/0002","gg/0001","-1/0001","0001*0","0001*-2","0001*10000001","0001*2junk","0001*2*3","0001*18446744073709551616"})test("reject "+token,[&]{auto h=make();trace("# FORJA65_LOGIC_TRACE 1\n"+token+"\n");bool rejected=false;try{h->loadLogicReplay("logic.txt");}catch(const std::exception&){rejected=true;}check(rejected,"invalid token accepted");});
 for(const std::string header:{"space=CART","addr=80 space=BWRAM"})test("reject "+header,[&]{auto h=make();trace("# FORJA65_LOGIC_TRACE 1 "+header+"\n0001\n");bool rejected=false;try{h->loadLogicReplay("logic.txt");}catch(const std::exception&){rejected=true;}check(rejected,"invalid memory space/address accepted");});
 return failed?1:0;
}
