#include "generated.hpp"
#include "forja_scpu_aot.hpp"
#include <iostream>
void forja65_dispatch_restored(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t);
static void check(bool b,const char*s){if(!b)throw std::runtime_error(s);}
int main(int argc,char**argv){try{
 check(argc==2,"ROM argument");CpuState c;c.i=false;c.c=true;
 auto p=std::make_unique<SnesRuntime>(argv[1],MapperKind::SA1,32768,12,5,CartChip::SA1,"test.srm",1,true);auto&h=*p;
 forja65_scpu_aot_start(h);bool miss=false;
 try{forja65_dispatch(c,h,0x8000,0xffffff);}catch(const std::runtime_error&){miss=true;}
 check(miss,"unknown next instruction must throw");check(!c.c,"real reset CLC must execute");check(h.cpuInstructionCount==1,"only observed CLC may execute");check(h.cpuInterpreterInstructions==0,"interpreter instruction count");check(h.lastInstructionPc==0x8000,"unknown instruction executed");check(!forja65_interpreter_enabled(),"interpreter unexpectedly enabled");check(!forja65_interpreter_hooks.interpret&&!forja65_interpreter_hooks.report,"interpreter hooks registered");
 std::ifstream in("forja65-unresolved-targets.txt");std::string log((std::istreambuf_iterator<char>(in)),{});check(log.find("8001")!=std::string::npos,"missing frontier must identify 008001");
 forja65_interpreter_report("interpreter.txt");std::ifstream r("interpreter.txt");std::string report((std::istreambuf_iterator<char>(r)),{});check(report.find("instructions=0")!=std::string::npos,"zero report missing");
 h.stopped=true;forja65_dispatch(c,h,0x8000,0xffffff);check(h.cpuInstructionCount==1,"stopped runtime executed instruction");

 auto second=std::make_unique<SnesRuntime>(argv[1],MapperKind::SA1,32768,12,5,CartChip::SA1,"test.srm",1,true);CpuState sei;sei.i=false;miss=false;
 try{forja65_dispatch_restored(sei,*second,0x18000,0xffffff);}catch(const std::runtime_error&){miss=true;}
 check(miss&&sei.i&&second->cpuInstructionCount==1&&second->cpuInterpreterInstructions==0,"real SEI / unknown next PC");
 std::cout<<"OBSERVED_ONLY_FRONTIER_PASS CLC008000 SEI018000 cpu=1 interpreter=0 per case\n";
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
