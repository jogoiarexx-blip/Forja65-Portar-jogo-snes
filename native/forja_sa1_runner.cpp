#include "generated.hpp"
#include <fstream>
#include <iomanip>
#include <memory>
#include <unordered_set>
#include "forja_sa1_aot.hpp"
ForjaSa1AotHooks forja65_sa1_aot{};
void forja65_interpret_step(CpuState&,SnesRuntime&,std::uint32_t,const std::uint8_t[4]);
// Explicit development-only backend. Counts are kept apart from S-CPU AOT.
// Does NOT claim SA-1 AOT or cycle-accurate bus arbitration.
struct ForjaSa1Research {
 SnesRuntime&parent;std::unique_ptr<SnesRuntime> bus;CpuState cpu;std::uint32_t pc{};
 std::uint64_t clock{},instructions{};bool waiting{},syncing{},nmiObserved{};
 std::ofstream trace;std::unordered_set<std::uint32_t> observed;bool native{};
 explicit ForjaSa1Research(SnesRuntime&p):parent(p),bus(std::make_unique<SnesRuntime>()){
  bus->sa1Side=true;bus->sa1Parent=&parent;bus->headless=true;bus->instructionWatchdogLimit=0;bus->mapper=MapperKind::SA1;bus->cartChip=CartChip::SA1;bus->cart=parent.cart;bus->romLogicalSize=parent.romLogicalSize;
  native=parent.sa1BackendName==std::string("AOT_EXPERIMENTAL");
  if(const char*path=std::getenv("FORJA65_SA1_TRACE"))trace.open(path);
 }
 ~ForjaSa1Research(){std::ofstream out("forja65-sa1-research.txt");if(out)out<<"backend="<<(native?"AOT_EXPERIMENTAL":"INTERPRETER_RESEARCH")<<"\ninstructions="<<instructions<<"\npc="<<std::hex<<pc<<"\ncycles_master="<<std::dec<<clock<<"\n";}
 void sync(){
  if(syncing)return;syncing=true;
  struct Clear{bool&x;~Clear(){x=false;}}clear{syncing};
  auto&chip=parent.sa1Board();const auto limit=parent.cpuMasterClock;
  if(chip.resetPending){chip.resetPending=false;cpu=CpuState{};pc=chip.vector(3);waiting=false;bus->stopped=false;bus->nativeReturns.clear();clock=limit;}
  if(chip.held()||bus->stopped){clock=limit;parent.updateSa1Irq();return;}
  unsigned safety=0;
  while(clock<limit&&safety++<100000){
   const bool nmi=chip.sa1Nmi();const bool irq=chip.sa1Irq();
   if(waiting&&!(nmi||irq)){chip.tick(unsigned(limit-clock));clock=limit;break;}
   if(nmi||irq)waiting=false;
   if((nmi&&!nmiObserved)||(irq&&!cpu.i)){
    const bool takeNmi=nmi&&!nmiObserved;cpu.enterInterrupt(*bus,pc,false);pc=chip.vector(takeNmi?5:7);
    if(takeNmi){chip.cf&=~0x10u;nmiObserved=true;}clock+=16;
   }
   if(!nmi)nmiObserved=false;
   std::uint8_t b[4]{};
   for(unsigned k=0;k<4;k++)b[k]=chip.read(true,(pc&0xff0000u)|((pc+k)&65535u),0xff);
   cpu.pb=pc>>16;bus->dispatchPending=false;bus->cpuMasterClock=clock;
   const unsigned signature=(cpu.e?4u:0u)|(cpu.m8?2u:0u)|(cpu.x8?1u:0u);
   if(trace&&observed.insert((pc<<3)|signature).second){trace<<std::hex<<pc<<' '<<signature;for(auto value:b)trace<<' '<<unsigned(value);trace<<'\n';trace.flush();}
   const auto before=bus->cpuMasterClock;const auto returns=bus->nativeReturns.size();
   if(b[0]==0xcb){bus->traceInstruction(pc,cpu,0xcb);bus->advanceCpuMasterCycles(6);pc=(pc&0xff0000u)|((pc+1)&65535u);waiting=true;}
   else if(b[0]==0xdb){bus->traceInstruction(pc,cpu,0xdb);bus->advanceCpuMasterCycles(6);bus->stopped=true;}
   else{
    if(native){if(!forja65_sa1_aot.step(cpu,*bus,pc,b)){std::ofstream miss("forja65-sa1-aot-frontier.txt",std::ios::app);miss<<std::hex<<pc<<" state="<<signature<<" bytes="<<unsigned(b[0])<<" "<<unsigned(b[1])<<" "<<unsigned(b[2])<<" "<<unsigned(b[3])<<"\n";throw std::runtime_error("SA1 AOT missing observed PC/state or code bytes");}}
    else {
#ifdef FORJA65_SA1_NO_INTERPRETER
     throw std::runtime_error("SA1 interpreter was omitted from this build");
#else
     forja65_interpret_step(cpu,*bus,pc,b);
#endif
    }
    if(bus->dispatchPending)pc=bus->dispatchTarget;
    else if(returns>bus->nativeReturns.size())pc=bus->nativeReturnedTarget;
    else if(!bus->stopped)throw std::runtime_error("SA1 research step failed to produce next PC");
   }
   auto spent=bus->cpuMasterClock-before;if(!spent)spent=2;
   chip.tick(unsigned(spent));clock+=spent;++instructions;if(native)parent.sa1AotInstructions++;else parent.sa1InterpreterInstructions++;
   if(chip.held())break;
  }
  parent.updateSa1Irq();
 }
};
void forja65_sa1_start(SnesRuntime&hw){
 if(hw.mapper!=MapperKind::SA1)return;
 hw.sa1Board();
 const auto mode=SnesRuntime::envText("FORJA65_SA1_MODE");
 const bool aot=forja65_sa1_aot.step&&(mode.empty()||mode=="strict"||mode=="aot");
 if(!aot&&mode!="research"){if(mode.empty()||mode=="strict")return;throw std::runtime_error("SA1 AOT backend missing, or invalid FORJA65_SA1_MODE");}
 if(aot&&(!forja65_sa1_aot.romHash||hw.cartHashHex()!=forja65_sa1_aot.romHash))throw std::runtime_error("SA1 AOT ROM fingerprint mismatch");
 hw.sa1BackendName=aot?"AOT_EXPERIMENTAL":"INTERPRETER_RESEARCH";
 auto driver=std::make_shared<ForjaSa1Research>(hw);hw.sa1RunnerState=driver;
 hw.sa1Tick=+[](SnesRuntime&h){static_cast<ForjaSa1Research*>(h.sa1RunnerState.get())->sync();};
}
