#include "generated.hpp"
#include "ares_stack_reference_v043619.hpp"
#include <fstream>
#include <iostream>
#include <memory>
#include <sstream>
using namespace upstream_ares_reference;
static std::vector<BusEvent> bus(const char*path){std::ifstream f(path);std::vector<BusEvent> out;std::string line;while(std::getline(f,line)){if(line.empty()||line[0]=='#')continue;std::vector<std::string> t;std::stringstream s(line);std::string x;while(std::getline(s,x,','))t.push_back(x);if(t.size()==9&&(t[4]=="read"||t[4]=="write"))out.push_back({t[4]=="read"?'r':'w',unsigned(std::stoul(t[6])),unsigned(std::stoul(t[7]))});}return out;}
static unsigned hook(CpuState&,SnesRuntime&){return 0;}
static void event(std::ofstream&out,unsigned&seq,const char*name,const std::string&state){out<<"{\"kind\":\"event\",\"seq\":"<<seq++<<",\"frame\":0,\"domain\":\"CPU\",\"event\":\""<<name<<"\",\"state\":"<<state<<"}\n";}
static void stream(std::ofstream&out,unsigned&seq,unsigned pc,bool e,unsigned sp,unsigned dp,const std::vector<BusEvent>&events,unsigned s,unsigned d,unsigned a,bool n,bool z,bool stopped,unsigned returned,const std::uint8_t*ram){
 std::ostringstream state;state<<"{\"pc\":"<<pc<<",\"e\":"<<(e?"true":"false")<<",\"s\":"<<sp<<",\"d\":"<<dp<<"}";event(out,seq,"case",state.str());
 for(const auto&b:events){state.str("");state.clear();state<<"{\"address\":"<<b.address<<",\"value\":"<<b.value<<"}";event(out,seq,b.kind=='r'?"read":"write",state.str());}
 std::uint64_t hash=14695981039346656037ull;for(unsigned i=0;i<8192;i++){hash^=ram[i];hash*=1099511628211ull;}
 state.str("");state.clear();state<<"{\"s\":"<<s<<",\"d\":"<<d<<",\"a\":"<<a<<",\"n\":"<<(n?"true":"false")<<",\"z\":"<<(z?"true":"false")<<",\"stopped\":"<<(stopped?"true":"false")<<",\"returned\":"<<returned<<",\"wram_fnv1a64\":"<<hash<<"}";event(out,seq,"result",state.str());
}
int main(){unsigned cases=0,failures=0,rseq=0,cseq=0;std::ofstream revents("reference-events.jsonl"),cevents("candidate-events.jsonl");std::ifstream rh("reference-header.json"),ch("candidate-header.json");revents<<rh.rdbuf();cevents<<ch.rdbuf();std::ofstream report("results.json");report<<"{\"schema\":\"forja65.stack-diff.v1\",\"cases\":[";
for(bool e:{false,true})for(unsigned sp:{0x100u,0x101u,0x102u,0x1a0u,0x1fdu,0x1feu,0x1ffu,0x200u})for(unsigned pc:{0x8100u,0x8110u,0x8120u,0x8130u,0x8140u,0x8150u,0x8160u,0x8170u,0x8180u,0x8190u,0x81a0u,0x81b0u})for(unsigned dp:{0x200u,0xff00u,0xffffu}){
 if((e&&sp>0x1ff)||(pc!=0x8130&&dp!=0x200))continue;
 auto h=std::make_unique<SnesRuntime>();h->loadCart("assets/cart-data.bin");CpuState c;c.e=e;c.m8=c.x8=true;c.s=std::uint16_t(sp);c.d=std::uint16_t(dp);c.a=0x5533;c.x=0;c.n=c.z=false;
 auto ref=std::make_unique<AresStackReference>();ref->EF=e;ref->S.w=c.s;ref->D.w=c.d;ref->X.w=c.x;ref->PC.d=pc+1;
 for(unsigned a=0;a<8192;a++)h->ram[a]=ref->memory[a]=std::uint8_t((a*37+0x65)&255);
 for(unsigned a=0x8000;a<65536;a++)ref->memory[a]=h->cart[a-0x8000];
 h->ram[0x200]=ref->memory[0x200]=0x90;h->ram[0x201]=ref->memory[0x201]=0x88;h->ram[0x2ff]=ref->memory[0x2ff]=0x54;h->ram[0x300]=ref->memory[0x300]=0x76;
 if(pc==0x8170||pc==0x8180||pc==0x81b0){for(unsigned depth=1;depth<=3;depth++){unsigned addr=(pc==0x8180&&e)?0x100|((sp+depth)&255):std::uint16_t(sp+depth);unsigned value=depth==1?0xff:depth==2?0x81:0;h->ram[addr]=ref->memory[addr]=std::uint8_t(value);}h->pushNativeReturn(0x8200,pc!=0x8180,c);}
 unsigned expectedA=c.a;bool expectedN=false,expectedZ=false;unsigned target=pc;
 switch(pc){case 0x8100:ref->instructionPushD();break;case 0x8110:ref->instructionPullD();expectedN=ref->NF;expectedZ=ref->ZF;break;case 0x8120:ref->instructionPushEffectiveAddress();break;case 0x8130:ref->instructionPushEffectiveIndirectAddress();break;case 0x8140:ref->instructionPushEffectiveRelativeAddress();break;case 0x8150:ref->instructionCallLong();target=ref->PC.d;break;case 0x8160:ref->instructionCallIndexedIndirect();target=ref->PC.d;expectedA=0x5500|ref->memory[target+1];expectedN=(expectedA&0x80)!=0;expectedZ=(expectedA&255)==0;break;case 0x81b0:case 0x8170:ref->instructionReturnLong();target=ref->PC.d;break;case 0x8180:ref->instructionReturnShort();target=ref->PC.d;break;case 0x8190:ref->push(0x33);break;case 0x81a0:expectedA=0x5500|ref->pull();expectedN=(expectedA&0x80)!=0;expectedZ=(expectedA&255)==0;break;}
 h->trace.start("stack-native.csv",h->cartHashHex());std::string error;
 try{if(pc==0x81b0){h->registerNativeHook({pc,hook,nullptr,-1,-1,-1});if(!h->runNativeHook(pc,c))throw std::runtime_error("hook did not execute");}else forja65_dispatch(c,*h,pc,0);}catch(const std::exception&ex){error=ex.what();}
 h->trace.close();auto events=bus("stack-native.csv");
 // Return authorization peeks are existing diagnostic reads. Both the peek and
 // actual pull must match the same physical stack bytes; no cycle claim follows.
 if(pc==0x8170||pc==0x8180||pc==0x81b0){auto pulls=ref->events;std::vector<BusEvent> expected=pulls;/* REV132: RTS/RTL read the return address once (dropStack), as on hardware; the native-hook RTL path still peeks before the hook */if(pc==0x81b0){expected.insert(expected.end(),pulls.begin(),pulls.end());expected.insert(expected.end(),pulls.begin(),pulls.end());}ref->events=expected;}
 bool memory=true;unsigned firstMemory=0;for(unsigned a=0;a<8192;a++)if(h->ram[a]!=ref->memory[a]){memory=false;firstMemory=a;break;}
 bool ok=error.empty()&&c.s==ref->S.w&&c.d==ref->D.w&&c.a==expectedA&&c.n==expectedN&&c.z==expectedZ&&(h->stopped==(pc!=0x8170&&pc!=0x8180&&pc!=0x81b0))&&events==ref->events;
 if(pc==0x8150||pc==0x8160)ok=ok&&h->nativeReturns.size()==1&&h->nativeReturns.back().stackPointer==c.s&&h->nativeReturns.back().target==pc+(pc==0x8150?4:3)&&h->lastInstructionPc==target+(pc==0x8160?2:0);
 if(pc==0x8170||pc==0x8180||pc==0x81b0)ok=ok&&h->nativeReturns.empty()&&h->nativeReturnedTarget==0x8200&&(pc==0x81b0?h->nativeHookCalls==1:h->lastInstructionPc==pc);
 ok=ok&&memory;
 stream(revents,rseq,pc,e,sp,dp,ref->events,ref->S.w,ref->D.w,expectedA,expectedN,expectedZ,pc!=0x8170&&pc!=0x8180&&pc!=0x81b0,pc==0x8170||pc==0x8180||pc==0x81b0?0x8200:0,ref->memory.data());
 stream(cevents,cseq,pc,e,sp,dp,events,c.s,c.d,c.a,c.n,c.z,h->stopped,h->nativeReturnedTarget,h->ram.data());
 if(cases++)report<<',';report<<"{\"pc\":"<<pc<<",\"e\":"<<(e?"true":"false")<<",\"input_s\":"<<sp<<",\"passed\":"<<(ok?"true":"false")<<",\"expected_s\":"<<ref->S.w<<",\"actual_s\":"<<c.s<<",\"expected_bus_events\":"<<ref->events.size()<<",\"actual_bus_events\":"<<events.size()<<"}";
 if(!ok){failures++;if(failures<=20)std::cerr<<"STACK_DIFF pc="<<std::hex<<pc<<" E="<<e<<" S="<<sp<<" actualS="<<c.s<<" refS="<<ref->S.w<<" memory="<<memory<<" first="<<firstMemory<<" bus="<<(events==ref->events)<<" error="<<error<<'\n';}
}
revents<<"{\"kind\":\"footer\",\"complete\":true,\"dropped\":0,\"events\":"<<rseq<<"}\n";cevents<<"{\"kind\":\"footer\",\"complete\":true,\"dropped\":0,\"events\":"<<cseq<<"}\n";
 report<<"],\"total\":"<<cases<<",\"divergences\":"<<failures<<",\"cycle_oracle\":false,\"gameplay_verified\":false}\n";
std::cout<<(failures?"STACK_BOUNDARY_V043619_FAIL":"STACK_BOUNDARY_V043619_PASS")<<" cases="<<std::dec<<cases<<" divergences="<<failures<<" generated=1 state_memory_bus=1 reference=ares-micro\n";return failures?1:0;}
