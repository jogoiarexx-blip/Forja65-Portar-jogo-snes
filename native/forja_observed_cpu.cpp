// REV204: fail-closed observed SCPU dispatcher. No CFG or interpreter backend.
#include "generated.hpp"
#include "forja_scpu_aot.hpp"
ForjaInterpreterHooks forja65_interpreter_hooks{};
bool forja65_interpreter_enabled(){return false;}
bool forja65_is_stack_return_target(std::uint32_t,SnesRuntime&){return false;}
bool forja65_has_compiled(SnesRuntime&,std::uint32_t,const CpuState&){return false;}
void forja65_interpreter_report(const char*path){
 if(!path||!*path)return;std::ofstream out(path,std::ios::trunc);
 if(out)out<<"FORJA65_CPU_INTERPRETER 1\nbackend=OMITTED_OBSERVED_ONLY\nblocks=0\ninstructions=0\n";
}
void forja65_interpret(CpuState&cpu,SnesRuntime&hw,std::uint32_t pc,std::uint32_t from,bool(*)(SnesRuntime&,std::uint32_t,const CpuState&)){
 hw.unresolvedFlow(from,pc,cpu);
}
void forja65_flow_or_interpret(CpuState&,SnesRuntime&hw,std::uint32_t from,std::uint32_t target){hw.requestDispatch(target,from);}
void forja65_wait(CpuState&cpu,SnesRuntime&hw,std::uint32_t pc){
 while(!hw.stopped&&!hw.cpuNmiInterruptPending&&!hw.cpuIrqInterruptPending){
  hw.advanceCpuMasterCycles(64);if(hw.sa1Tick)hw.sa1Tick(hw);
  if(hw.hostFrameReady){hw.hostFrameReady=false;hw.present();}
 }
 if(!hw.stopped)hw.serviceCpuEvents(cpu,pc,false);
}
void forja65_dispatch(CpuState&cpu,SnesRuntime&hw,std::uint32_t pc,std::uint32_t from){
 pc&=0xFFFFFFu;
 while(!hw.stopped){
  if(hw.sa1Tick)hw.sa1Tick(hw);
  cpu.pb=std::uint8_t(pc>>16);hw.dispatchPending=false;
  if(hw.serviceCpuEvents(cpu,pc)){from=pc;pc=hw.dispatchTarget;continue;}
  const auto returns=hw.nativeReturns.size();
  if(!forja65_scpu_aot_step(cpu,hw,pc))hw.unresolvedFlow(from,pc,cpu);
  if(hw.stopped)return;
  from=pc;
  if(hw.dispatchPending)pc=hw.dispatchTarget;
  else if(returns>hw.nativeReturns.size())pc=hw.nativeReturnedTarget;
  else throw std::runtime_error("Observed SCPU AOT step failed to produce next PC");
 }
}
// Observed instructions consume actual CPU-stack returns; restored entry needs no CFG reconstruction.
void forja65_dispatch_restored(CpuState&cpu,SnesRuntime&hw,std::uint32_t target,std::uint32_t from){
 forja65_dispatch(cpu,hw,target,from);
}
