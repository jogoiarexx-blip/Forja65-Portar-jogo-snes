#include "runtime.hpp"
#include <iostream>
#include <functional>
static void check(bool v,const char*m){if(!v)throw std::runtime_error(m);}
static bool rejects(const std::function<void()>&f){try{f();return false;}catch(const std::exception&){return true;}}
static void env(const char*k,const char*v){
#ifdef _WIN32
 _putenv_s(k,v?v:"");
#else
 if(v)setenv(k,v,1);else unsetenv(k);
#endif
}
int main(){unsigned fails=0;auto test=[&](const char*name,const std::function<void()>&f){try{f();std::cout<<"PASS "<<name<<'\n';}catch(const std::exception&e){fails++;std::cerr<<"FAIL "<<name<<": "<<e.what()<<'\n';}};
 auto make=[](){auto h=std::make_unique<SnesRuntime>();h->cart={0x12};h->romLogicalSize=1;return h;};
 auto write=[](const std::string&s){std::ofstream("poll.txt",std::ios::binary)<<s;};
 auto header=[](SnesRuntime&h){return "# FORJA65_INPUT_POLL 1 rom="+h.cartHashHex()+"\n";};
 test("legacy no replay",[&]{auto h=make();h->io.autoJoyLatched[0]=0x1234;check(h->readBus(0x4218)==0x34&&h->readBus(0x4219)==0x12,"legacy input changed");});
 test("both controls, all ports, duplicates, no memory/timing changes",[&]{auto h=make();h->sram.resize(64,7);h->ram[5]=17;h->cpuMasterClock=42;write(header(*h)+"4218 11\n4218 22\n4219 33\n421a 44\n421b 55\n421c 66\n421d 77\n421e 88\n421f 99\n");h->loadInputPoll("poll.txt");
 for(auto [a,v]:std::vector<std::pair<unsigned,unsigned>>{{0x4218,0x11},{0x4218,0x22},{0x4219,0x33},{0x421a,0x44},{0x421b,0x55},{0x421c,0x66},{0x421d,0x77},{0x421e,0x88},{0x421f,0x99}})check(h->readBus(a)==v,"input value mismatch");check(h->inputPollPos==9,"wrong position");check(h->ram[5]==17&&h->sram[5]==7&&h->cpuMasterClock==42,"state changed");check(rejects([&]{h->readBus(0x4218);}),"exhaustion allowed");});
 test("address mismatch rejects without advancing",[&]{auto h=make();write(header(*h)+"4219 12\n");h->loadInputPoll("poll.txt");check(rejects([&]{h->readBus(0x4218);}),"mismatch allowed");check(h->inputPollPos==0,"advanced on mismatch");});
 test("SA1 side excluded",[&]{auto h=make();write(header(*h)+"4218 12\n");h->loadInputPoll("poll.txt");h->sa1Side=true;check(h->inputPollRead(0x4218,0x54)==0x54&&h->inputPollPos==0,"SA1 consumed input");h->sa1Side=false;});
 test("reject invalid and poison failed load",[&]{auto h=make();for(auto suffix:{"", "4217 12\n","4220 00\n","4218 gg\n","4218 100\n","4218 00", "4218 00\n\n", "4218 00 trailing\n", "#comment\n"}){write(header(*h)+suffix);check(rejects([&]{h->loadInputPoll("poll.txt");}),"invalid trace accepted");check(h->inputPollActive&&!h->inputPollReady,"load failure allowed fallback");check(rejects([&]{h->inputPollRead(0x4218,0);}),"bad file fell back");}write("# FORJA65_INPUT_POLL 1 rom=bad\n4218 00\n");check(rejects([&]{h->loadInputPoll("poll.txt");}),"wrong ROM accepted");});
 test("mutually exclusive replay modes",[&]{auto h=make();env("FORJA65_INPUT_POLL","poll.txt");env("FORJA65_INPUT_LOGIC","other");check(rejects([&]{h->initInputTraceFromEnv();}),"logic conflict accepted");env("FORJA65_INPUT_LOGIC",nullptr);env("FORJA65_INPUT_REPLAY","other");check(rejects([&]{h->initInputTraceFromEnv();}),"wall conflict accepted");env("FORJA65_INPUT_REPLAY",nullptr);env("FORJA65_INPUT_POLL",nullptr);});
 test("bound of ten million records",[&]{auto h=make();{std::ofstream f("poll.txt",std::ios::binary);f<<header(*h);const std::string block=[](){std::string x;for(int i=0;i<1000;i++)x+="4218 00\n";return x;}();for(int i=0;i<10000;i++)f<<block;}h->loadInputPoll("poll.txt");check(h->inputPoll.size()==10000000,"valid maximum rejected");{std::ofstream f("poll.txt",std::ios::app);f<<"4218 00\n";}check(rejects([&]{h->loadInputPoll("poll.txt");}),"oversize accepted");});
 return fails?1:0;
}
