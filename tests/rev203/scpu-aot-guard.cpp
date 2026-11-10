#include "forja_scpu_aot.hpp"
#include <memory>
#include <iostream>
static void check(bool x){if(!x)throw std::runtime_error("SCPU observed AOT guard failure");}
ForjaInterpreterHooks forja65_interpreter_hooks{};
bool forja65_interpreter_enabled(){return false;}
bool forja65_is_stack_return_target(std::uint32_t,SnesRuntime&){return false;}
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){throw std::runtime_error("unexpected dispatch");}
void forja65_wait(CpuState&,SnesRuntime&,std::uint32_t){throw std::runtime_error("unexpected wait");}
int main(){
 auto hp=std::make_unique<SnesRuntime>();auto&h=*hp;h.headless=true;CpuState c;c.e=c.m8=c.x8=false;c.pb=0x7e;c.a=0x1234;
 check(forja65_scpu_aot.step);bool rejected=false;try{forja65_scpu_aot_start(h);}catch(const std::runtime_error&){rejected=true;}check(rejected);
 h.nativeRom.sourceHash=0x450b6a34c1050e03ull;forja65_scpu_aot_start(h);
 for(unsigned k=0;k<4;k++)h.ram[0x220+k]=0xeb;
 check(!forja65_scpu_aot_step(c,h,0x2220));check(h.cpuInstructionCount==0);
 c.m8=true;check(!forja65_scpu_aot_step(c,h,0x7e0220));c.m8=false;
 h.ram[0x220]=0xea;check(!forja65_scpu_aot_step(c,h,0x7e0220));check(c.a==0x1234&&h.cpuInstructionCount==0);
 h.ram[0x220]=0xeb;check(forja65_scpu_aot_step(c,h,0x7e0220));check(c.a==0x3412&&h.cpuInstructionCount==1&&h.dispatchTarget==0x7e0221);
 c.pb=0;h.ram[0x1fff]=0xeb;check(forja65_scpu_aot_step(c,h,0x1fff));check(c.a==0x1234);
 h.ram[0x1fff]=0xa9;c.m8=true;check(!forja65_scpu_aot_step(c,h,0x1fff));
 check(h.cpuInterpreterInstructions==0);std::cout<<"SCPU_OBSERVED_AOT_GUARDS_PASS\n";
}
