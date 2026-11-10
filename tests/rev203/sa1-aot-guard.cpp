#include "generated.hpp"
#include "forja_sa1_aot.hpp"
#include <memory>
#include <iostream>
#include <stdexcept>
static void check(bool x){if(!x)throw std::runtime_error("SA1 AOT guard regression");}
ForjaInterpreterHooks forja65_interpreter_hooks{};
bool forja65_interpreter_enabled(){return false;}
bool forja65_is_stack_return_target(std::uint32_t,SnesRuntime&){return false;}
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){throw std::runtime_error("unexpected dispatch");}
void forja65_wait(CpuState&,SnesRuntime&,std::uint32_t){throw std::runtime_error("unexpected wait");}
int main(){
 auto hp=std::make_unique<SnesRuntime>();auto&h=*hp;h.sa1Side=true;h.headless=true;CpuState c;c.i=false;
 check(forja65_sa1_aot.step!=nullptr);const std::uint8_t valid[4]={0x78,0x18,0xfb,0xe2};
 auto bad=std::array<std::uint8_t,4>{0xea,0x18,0xfb,0xe2};
 check(!forja65_sa1_aot.step(c,h,0x8294,bad.data()));check(!c.i&&h.cpuInstructionCount==0);
 check(!forja65_sa1_aot.step(c,h,0x123456,valid));
 c.e=false;c.m8=false;c.x8=false;check(!forja65_sa1_aot.step(c,h,0x8294,valid));
 c.e=false;c.m8=c.x8=true;const std::uint8_t operandMismatch[4]={0xe2,0x10,0x9c,0x0a};check(!forja65_sa1_aot.step(c,h,0x8297,operandMismatch));
 c.e=c.m8=c.x8=true;check(forja65_sa1_aot.step(c,h,0x8294,valid));check(c.i&&h.cpuInstructionCount==1);
 std::cout<<"REV203_SA1_AOT_GUARDS_PASS\n";
}
