#include "generated.hpp"
#include "ares_blockmove_reference_v043621.hpp"
#include <fstream>
#include <sstream>
#include <iostream>
#include <memory>
using namespace upstream_ares_reference;
static std::vector<BlockBusEvent> bus(const char*path){std::ifstream f(path);std::vector<BlockBusEvent> out;std::string line;while(std::getline(f,line)){if(line.empty()||line[0]=='#')continue;std::vector<std::string> t;std::stringstream s(line);std::string x;while(std::getline(s,x,','))t.push_back(x);if(t.size()==9&&(t[4]=="read"||t[4]=="write")){unsigned a=unsigned(std::stoul(t[6]));if((a&0xfe0000)==0x7e0000)out.push_back({t[4]=="read"?'r':'w',a,unsigned(std::stoul(t[7]))});}}return out;}
int main(){unsigned cases=0,failures=0,stateFailures=0,memoryFailures=0,busFailures=0,clockFailures=0;std::ofstream report("blockmove-results.json");report<<"{\"cases\":[";
for(unsigned root:{0x8100u,0x8150u,0x8200u,0x8250u,0x8300u,0x8350u})for(unsigned mode=0;mode<5;mode++)for(unsigned pair=0;pair<3;pair++)for(unsigned count:{1u,2u,4u,256u,257u,512u,65536u})for(unsigned profile=0;profile<3;profile++){
 if(count==65536&&(pair||root!=0x8100||profile||!(mode==1||mode==3||mode==4)))continue;
 auto h=std::make_unique<SnesRuntime>();h->loadCart("assets/cart-data.bin");CpuState c;c.e=mode==4;c.m8=mode==1||mode==3||mode==4;c.x8=mode>=2;c.a=std::uint16_t(count-1);c.s=0x1a0;c.d=0x1234;c.c=true;c.z=true;c.n=true;c.v=true;c.decimalMode=true;c.i=true;
 bool down=root==0x8150||root==0x8250||root==0x8350;unsigned src=root<0x8300?(root<0x8200?0x7e:0x7f):0x7f,dst=root<0x8300?0x7f:0x7e;
 unsigned limit=c.x8?255:65535;c.x=std::uint16_t(pair==0?(down?0:limit):pair==1?(down?2:limit-1):0);c.y=std::uint16_t(pair==0?(down?1:limit-1):pair==1?(down?1:limit):2);auto initialP=c.packP();
 auto ref=std::make_unique<AresBlockMoveReference>();ref->A.w=c.a;ref->X.w=c.x;ref->Y.w=c.y;ref->observe=count<=512;ref->io.romSpeed=profile==2?6:8;h->io.memsel=profile==2;unsigned pc=(profile?0x800000:0)|root;
 for(unsigned a=0;a<0x20000;a++)h->ram[a]=ref->memory[a]=std::uint8_t((a*73u+(a>>8)*11u+(a>>16)*97u)&255);
 ref->code[root]=down?0x44:0x54;ref->code[root+1]=std::uint8_t(dst);ref->code[root+2]=std::uint8_t(src);ref->run(pc,down?0x44:0x54,c.x8);
 if(ref->observe)h->trace.start("blockmove-native.csv",h->cartHashHex(),200000);
 forja65_dispatch(c,*h,pc,0);h->trace.close();auto observed=ref->observe?bus("blockmove-native.csv"):std::vector<BlockBusEvent>{};
 bool state=c.a==ref->A.w&&c.x==ref->X.w&&c.y==ref->Y.w&&c.db==ref->B&&c.packP()==initialP&&c.s==0x1a0&&c.d==0x1234&&c.e==(mode==4)&&c.m8==(mode==1||mode==3||mode==4)&&c.x8==(mode>=2)&&h->stopped&&h->nativeReturns.empty();bool memory=h->ram==ref->memory,busevents=!ref->observe||observed==ref->events;auto actualClocks=h->cpuMasterClock-h->wramRefreshStallMasterCycles-h->dmaStallMasterCycles-h->hdmaStallMasterCycles-(12u+h->busMasterCycles(pc+3));bool clocks=actualClocks==ref->clocks;bool ok=state&&memory&&busevents&&clocks;
 stateFailures+=!state;memoryFailures+=!memory;busFailures+=!busevents;clockFailures+=!clocks;
 if(!state&&stateFailures==1)std::cerr<<"BLOCKMOVE_FIRST_STATE x="<<c.x<<" expectedX="<<ref->X.w<<" y="<<c.y<<" expectedY="<<ref->Y.w<<'\n';
 if(!busevents&&busFailures==1){std::size_t q=0;while(q<observed.size()&&q<ref->events.size()&&observed[q]==ref->events[q])q++;std::cerr<<"BLOCKMOVE_FIRST_BUS index="<<q;if(q<observed.size()&&q<ref->events.size())std::cerr<<" actualAddress="<<std::hex<<observed[q].address<<" expectedAddress="<<ref->events[q].address<<std::dec;std::cerr<<'\n';}
 if(cases++)report<<',';report<<"{\"pc\":"<<pc<<",\"mode\":"<<mode<<",\"pair\":"<<pair<<",\"bytes\":"<<count<<",\"passed\":"<<(ok?"true":"false")<<",\"state\":"<<(state?"true":"false")<<",\"memory\":"<<(memory?"true":"false")<<",\"bus\":"<<(busevents?"true":"false")<<",\"bus_observed\":"<<(ref->observe?"true":"false")<<",\"actual_move_mc\":"<<actualClocks<<",\"reference_move_mc\":"<<ref->clocks<<"}";
 if(!ok){failures++;if(failures<=10)std::cerr<<"BLOCKMOVE_DIFF pc="<<std::hex<<pc<<" mode="<<mode<<" bytes="<<std::dec<<count<<" state="<<state<<" memory="<<memory<<" bus="<<busevents<<" actualMC="<<actualClocks<<" expectedMC="<<ref->clocks<<'\n';}
}
// Execute the existing byte-verified WRAM [MVN/MVP, dst, src, RTL] bridge
// through a generated JSL; retain its E=0 and X=16 restrictions.
for(unsigned root:{0x8400u,0x8450u})for(bool m8:{false,true})for(unsigned count:{1u,4u,257u})for(bool fast:{false,true}){
 auto h=std::make_unique<SnesRuntime>();h->loadCart("assets/cart-data.bin");h->io.memsel=fast;CpuState c;c.e=false;c.m8=m8;c.x8=false;c.s=0x1a0;c.d=0x1234;c.a=std::uint16_t(count-1);c.x=root==0x8400?0xffff:0;c.y=root==0x8400?0xfffe:1;c.c=c.z=c.n=c.v=c.decimalMode=c.i=true;auto initialP=c.packP();
 auto ref=std::make_unique<AresBlockMoveReference>();ref->io.romSpeed=fast?6:8;ref->A.w=c.a;ref->X.w=c.x;ref->Y.w=c.y;
 for(unsigned a=0;a<0x20000;a++)h->ram[a]=ref->memory[a]=std::uint8_t((a*73u+(a>>8)*11u+(a>>16)*97u)&255);
 unsigned stub=root==0x8400?0x1000:0x1010,op=root==0x8400?0x54:0x44,pb=fast?0x80:0,pc=(pb<<16)|root;
 for(unsigned i=0;i<4;i++){unsigned value=i==0?op:i==1?0x7f:i==2?0x7e:0x6b;h->ram[stub+i]=ref->memory[stub+i]=std::uint8_t(value);ref->code[stub+i]=std::uint8_t(value);}
 // Independent JSL stack bytes remain in WRAM after RTL, even when SP is restored.
 ref->memory[c.s]=std::uint8_t(pb);ref->memory[c.s-1]=std::uint8_t((root+3)>>8);ref->memory[c.s-2]=std::uint8_t(root+3);
 ref->run(0x7e0000|stub,op,false);h->trace.start("blockmove-native.csv",h->cartHashHex(),200000);forja65_dispatch(c,*h,pc,0);h->trace.close();auto observed=bus("blockmove-native.csv");
 unsigned jslCost=4u*(fast?6u:8u)+3u*8u+6u,rtlCost=8u+3u*8u+2u*6u;auto actualClocks=h->cpuMasterClock-h->wramRefreshStallMasterCycles-h->dmaStallMasterCycles-h->hdmaStallMasterCycles-(12u+h->busMasterCycles(pc+4))-jslCost-rtlCost;
 bool state=c.a==ref->A.w&&c.x==ref->X.w&&c.y==ref->Y.w&&c.db==ref->B&&c.packP()==initialP&&c.s==0x1a0&&c.d==0x1234&&!c.e&&c.m8==m8&&!c.x8&&c.pb==pb&&h->stopped&&h->nativeReturns.empty();bool memory=h->ram==ref->memory,busevents=observed==ref->events,clocks=actualClocks==ref->clocks,ok=state&&memory&&busevents&&clocks;
 stateFailures+=!state;memoryFailures+=!memory;busFailures+=!busevents;clockFailures+=!clocks;
 if(!state&&stateFailures==1)std::cerr<<"BLOCKMOVE_FIRST_STATE x="<<c.x<<" expectedX="<<ref->X.w<<" y="<<c.y<<" expectedY="<<ref->Y.w<<'\n';
 if(!busevents&&busFailures==1){std::size_t q=0;while(q<observed.size()&&q<ref->events.size()&&observed[q]==ref->events[q])q++;std::cerr<<"BLOCKMOVE_FIRST_BUS index="<<q;if(q<observed.size()&&q<ref->events.size())std::cerr<<" actualAddress="<<std::hex<<observed[q].address<<" expectedAddress="<<ref->events[q].address<<std::dec;std::cerr<<'\n';}
 if(cases++)report<<',';report<<"{\"wram_bridge\":true,\"pc\":"<<pc<<",\"bytes\":"<<count<<",\"passed\":"<<(ok?"true":"false")<<",\"state\":"<<(state?"true":"false")<<",\"memory\":"<<(memory?"true":"false")<<",\"bus\":"<<(busevents?"true":"false")<<",\"actual_move_mc\":"<<actualClocks<<",\"reference_move_mc\":"<<ref->clocks<<"}";if(!ok){failures++;if(failures<=10)std::cerr<<"WRAM_BLOCKMOVE_DIFF bytes="<<count<<" actualMC="<<actualClocks<<" expectedMC="<<ref->clocks<<'\n';}
}

// Direct cost probes include an operand fetch crossing the PB word boundary.
for(unsigned pc:{0x008100u,0x808100u,0x80fffeu,0x80ffffu})for(bool fast:{false,true}){
 auto h=std::make_unique<SnesRuntime>();h->io.memsel=fast;AresBlockMoveReference ref;ref.io.romSpeed=fast?6:8;ref.A.w=0;ref.X.w=0;ref.Y.w=0;ref.code[pc&65535]=0x54;ref.code[(pc+1)&65535]=0x7f;ref.code[(pc+2)&65535]=0x7e;ref.run(pc,0x54,false);h->advanceCpuBlockMove(pc,1,0x7e,0x7f);bool ok=h->cpuMasterClock-h->wramRefreshStallMasterCycles-h->dmaStallMasterCycles-h->hdmaStallMasterCycles==ref.clocks;if(cases++)report<<',';report<<"{\"timing_probe\":true,\"pc\":"<<pc<<",\"passed\":"<<(ok?"true":"false")<<",\"actual_move_mc\":"<<h->cpuMasterClock<<",\"reference_move_mc\":"<<ref.clocks<<"}";if(!ok){failures++;clockFailures++;}
}
report<<"],\"total\":"<<cases<<",\"differences\":"<<failures<<",\"state_failures\":"<<stateFailures<<",\"memory_failures\":"<<memoryFailures<<",\"bus_failures\":"<<busFailures<<",\"nominal_clock_failures\":"<<clockFailures<<",\"irq_refresh_dma_excluded\":true,\"gameplay_verified\":false}\n";std::cout<<(failures?"BLOCKMOVE_V043621_FAIL":"BLOCKMOVE_V043621_PASS")<<" cases="<<cases<<" differences="<<failures<<" state="<<stateFailures<<" memory="<<memoryFailures<<" bus="<<busFailures<<" nominal_clock="<<clockFailures<<'\n';return failures?1:0;}
