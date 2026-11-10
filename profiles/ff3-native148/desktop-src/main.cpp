#include <string>
#include "generated.hpp"
#include "forja_checkpoint.hpp"
#include "forja_user_states.hpp"
#include "forja_startup.hpp"
#include <iostream>
#include <fstream>
#include <cstdlib>
void forja65_interpreter_reset_observations();
#ifdef FORJA65_NATIVE_SPC_LINKED
int forja65_native_spc_instruction(ApuBridge&);
#endif
static void forja65Fatal(const char*msg){forja65_interpreter_report("forja65-cpu-interpreter.txt");std::ofstream f("forja65-last-error.txt",std::ios::trunc);if(f)f<<msg<<'\n';std::cerr<<msg<<'\n';
#ifdef _WIN32
MessageBoxA(nullptr,msg,"Forja65 - erro ao executar o port",MB_OK|MB_ICONERROR);
#endif
}
// REV137: o trace pode carregar o perfil com que foi gravado (linhas "# FORJA65_ENV CHAVE=VALOR" no cabecalho).
// No replay, cada chave FORJA65_* ainda nao definida no ambiente passa a valer (ex.: SPC_PROFILE=reference do modo de controle).
static const bool forja65_trace_env_applied=[](){const char*p=std::getenv("FORJA65_INPUT_REPLAY");if(!p||!*p)return false;std::ifstream in(p);std::string l;
  while(std::getline(in,l)){if(!l.empty()&&l.back()=='\r')l.pop_back();if(l.rfind("# FORJA65_ENV ",0)!=0){if(!l.empty()&&l[0]!='#')break;continue;}
    const std::string kv=l.substr(14);const auto eq=kv.find('=');if(eq==std::string::npos)continue;const std::string k=kv.substr(0,eq),v=kv.substr(eq+1);
    if(k.rfind("FORJA65_",0)!=0||std::getenv(k.c_str()))continue;
#ifdef _WIN32
    _putenv_s(k.c_str(),v.c_str());
#else
    setenv(k.c_str(),v.c_str(),0);
#endif
  }return true;}();
static int runSession(bool allowCheckpoint){CpuState cpu;try{SnesRuntime hw("assets/cart-data.bin",MapperKind::HiROM,0u,12u,0u,CartChip::None,"save.srm",1u);try{
#ifdef FORJA65_NATIVE_SPC_LINKED
hw.apu.setNativeInstructionHook(&forja65_native_spc_instruction);
#endif
forja65_register_native_hooks(hw);
if(hw.cartHashHex()!="0219ea8f95a4f0ed")throw std::runtime_error("ROM/native pack fingerprint mismatch: "+hw.cartHashHex()+" expected 0219ea8f95a4f0ed");
bool checkpointBoundaryReady=false;
bool checkpointSaved=false;
const char*resumeFile=std::getenv("FORJA65_CHECKPOINT_LOAD");
const bool haveResume=allowCheckpoint&&resumeFile&&*resumeFile;
bool resumeThisLoop=haveResume;
if(haveResume){auto state=forja_checkpoint::load(resumeFile,cpu,hw);std::cout<<"FORJA65_CHECKPOINT_LOADED frame="<<state.frame<<std::endl;}
else{hw.beginFrame();try{forja65_dispatch(cpu,hw,0x00FE00u,0xFFFFFFu);}catch(const ForjaCheckpointYield&){checkpointBoundaryReady=true;}catch(const std::exception&e){if(std::string(e.what())!="FORJA65_HEADLESS_COMPLETE"){
  hw.writeBootProbe(); forja65_interpreter_report("forja65-cpu-interpreter.txt");hw.writeNativeDependencyReport();
  std::ofstream state("forja65-cpu-failure.txt",std::ios::trunc);
  if(state)state<<std::hex<<"cpu_pb=0x"<<unsigned(cpu.pb)<<"\ncpu_a=0x"<<cpu.a<<"\ncpu_x=0x"<<cpu.x<<"\ncpu_y=0x"<<cpu.y<<"\ncpu_s=0x"<<cpu.s<<"\nlast_cpu_pc=0x"<<hw.lastInstructionPc<<"\n"<<std::dec<<"frames="<<hw.frameCounter<<"\ninstructions="<<hw.cpuInstructionCount<<"\n";
  throw;
}hw.stopped=true;}}unsigned lim=0;if(const char*e=std::getenv("FORJA65_HEADLESS_FRAMES"))lim=(unsigned)std::strtoul(e,nullptr,10);while(!hw.stopped){try{
if(forja148::pending.action==forja148::Action::Save||forja148::pending.action==forja148::Action::Load){
 const auto request=forja148::takeRequest();std::string result;bool ok=false;
 try{if(forja148::applyState(cpu,hw,request)){hw.apu.pcmOutput->discardQueued();resumeThisLoop=true;checkpointBoundaryReady=true;}result=(request.action==forja148::Action::Save?"Salvo slot ":"Carregado slot ")+std::to_string(request.slot);ok=true;}
 catch(const std::exception& e){result=e.what();}
 std::ofstream status("forja65-state-status.txt",std::ios::trunc);status<<"status="<<(ok?"PASS":"ERROR")<<"\nslot="<<request.slot<<"\nframe="<<hw.frameCounter<<"\nmessage="<<result<<'\n';
#ifdef _WIN32
 if(!hw.headless){forja148::desktop().status=result;SetWindowTextA(hw.hwnd,("Final Fight 3 - "+result+" | Esc: menu").c_str());}
#endif
}
if(!resumeThisLoop&&!checkpointBoundaryReady)forja65_wait(cpu,hw,hw.lastInstructionPc);
resumeThisLoop=false;checkpointBoundaryReady=false;
const char*saveFrame=std::getenv("FORJA65_CHECKPOINT_SAVE_AT");
const auto at=saveFrame&&*saveFrame?std::strtoull(saveFrame,nullptr,10):0ull;
if(at && !checkpointSaved && !hw.stopped && hw.frameCounter>=at){
const char*p=std::getenv("FORJA65_CHECKPOINT_PATH");
const std::string path=p&&*p?p:"forja65-near-crash.f65s";
auto state=forja_checkpoint::save(path,cpu,hw);
std::cout<<"FORJA65_CHECKPOINT_SAVED frame="<<state.frame<<std::endl;
checkpointSaved=true;
if(SnesRuntime::envFlag("FORJA65_CHECKPOINT_STOP")){hw.stopped=true;break;}
}
if(hw.dispatchPending){if(haveResume||hw.checkpointCaptured){extern void forja65_dispatch_restored(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t);forja65_dispatch_restored(cpu,hw,hw.dispatchTarget,hw.dispatchFrom);}else forja65_dispatch(cpu,hw,hw.dispatchTarget,hw.dispatchFrom);}hw.maybeCaptureNativeScene();if(lim&&hw.frameCounter>=lim)hw.stopped=true;}catch(const ForjaCheckpointYield&){checkpointBoundaryReady=true;continue;}catch(const std::exception&e){if(std::string(e.what())!="FORJA65_HEADLESS_COMPLETE"){
  hw.writeBootProbe(); forja65_interpreter_report("forja65-cpu-interpreter.txt");hw.writeNativeDependencyReport();
  std::ofstream state("forja65-cpu-failure.txt",std::ios::trunc);
  if(state)state<<std::hex<<"cpu_pb=0x"<<unsigned(cpu.pb)<<"\ncpu_a=0x"<<cpu.a<<"\ncpu_x=0x"<<cpu.x<<"\ncpu_y=0x"<<cpu.y<<"\ncpu_s=0x"<<cpu.s<<"\nlast_cpu_pc=0x"<<hw.lastInstructionPc<<"\n"<<std::dec<<"frames="<<hw.frameCounter<<"\ninstructions="<<hw.cpuInstructionCount<<"\n";
  throw;
}hw.stopped=true;}}forja65_interpreter_report("forja65-cpu-interpreter.txt");hw.writeNativeDependencyReport();hw.writePpuRegisterProfile();hw.writeBootProbe();std::ofstream qa("forja65-qa-status.txt",std::ios::trunc);if(qa)qa<<"FORJA65_QA 1\nrom="<<hw.cartHashHex()<<"\nruntime_started=PASS\nframes="<<hw.frameCounter<<"\ninstructions="<<hw.cpuInstructionCount<<"\nnmi_services="<<hw.nmiServiceCount<<"\nirq_services="<<hw.irqServiceCount<<"\nppu_forced_blank="<<((hw.ppu.regs[0]&0x80u)?1:0)<<"\nframebuffer_hash="<<std::hex<<hw.framebufferHash()<<"\nwram_hash="<<hw.ramHash()<<std::dec<<"\nnew_oracle_hints="<<(std::filesystem::exists("forja65-oracle-hints.txt")?"YES":"NO")<<"\nppu_virtual_accesses="<<(hw.hwUsage.ppuReads+hw.hwUsage.ppuWrites)<<"\nppu_accesses="<<(hw.hwUsage.ppuReads+hw.hwUsage.ppuWrites)<<"\nppu_native_accesses="<<(hw.hwUsage.ppuNativeReads+hw.hwUsage.ppuNativeWrites)<<"\nppu_fallback_accesses="<<(hw.hwUsage.ppuFallbackReads+hw.hwUsage.ppuFallbackWrites)<<"\napu_virtual_accesses="<<(hw.hwUsage.apuReads+hw.hwUsage.apuWrites)<<"\napu_accesses="<<(hw.hwUsage.apuReads+hw.hwUsage.apuWrites)<<"\napu_aot_instructions="<<hw.apu.spcAotInstructions<<"\napu_aot_misses="<<hw.apu.spcAotMisses<<"\napu_aot_spc_cycles="<<hw.apu.spcAotExecutedCycles<<"\napu_interpreter_spc_cycles="<<hw.apu.spcInterpreterExecutedCycles<<"\napu_master_cycle_accounting=backend_scheduled_intervals\napu_native_master_cycles="<<hw.apu.nativeMasterCycles<<"\napu_fallback_master_cycles="<<hw.apu.fallbackMasterCycles<<"\ndsp_native_samples="<<hw.apu.dspNativeSamples<<"\ndsp_fallback_samples="<<hw.apu.dspFallbackSamples<<"\nrom_runtime_reads="<<hw.hwUsage.romReads<<"\nrom_native_reads="<<hw.hwUsage.romNativeReads<<"\nrom_fallback_reads="<<hw.hwUsage.romFallbackReads<<"\ndma_bytes="<<hw.hwUsage.dmaBytes<<"\ndma_native_bytes="<<hw.hwUsage.dmaNativeBytes<<"\ndma_fallback_bytes="<<hw.hwUsage.dmaFallbackBytes<<"\nhdma_bytes="<<hw.hwUsage.hdmaBytes<<"\nhdma_native_bytes="<<hw.hwUsage.hdmaNativeBytes<<"\nhdma_fallback_bytes="<<hw.hwUsage.hdmaFallbackBytes<<"\n";std::cout<<"Forja65: port C++ executado, frames="<<hw.frameCounter<<"\n";}catch(const ForjaHostRestart&){
  std::filesystem::path archive;
  for(unsigned n=1;;++n){
    auto candidate=std::filesystem::path("restart-audit-"+std::to_string(n));
    std::error_code ec;
    if(std::filesystem::create_directory(candidate,ec)){archive=candidate;break;}
    if(ec)throw std::runtime_error("Cannot preserve restart audit: "+ec.message());
  }
  hw.apu.finishAudioOutput();
  hw.writeBootProbe((archive/"boot-probe.txt").string());
  if(!hw.writeNativeDependencyReport((archive/"native-dependency.txt").string()))
    throw std::runtime_error("Cannot preserve restart native audit");
  hw.writePpuRegisterProfile((archive/"ppu-register-profile.csv").string());
  hw.writeAudioReport((archive/"audio-report.txt").string());
  forja65_interpreter_report((archive/"cpu-interpreter.txt").string().c_str());
  if(!hw.inputRecordPath.empty()&&std::filesystem::exists(hw.inputRecordPath))
    std::filesystem::copy_file(hw.inputRecordPath,archive/"input-record.trace");
  if(!std::filesystem::exists(archive/"boot-probe.txt")||!std::filesystem::file_size(archive/"boot-probe.txt")||
     ((hw.apu.pcmOutput->liveRequested||hw.apu.pcmOutput->wavRequested)&&
      (!std::filesystem::exists(archive/"audio-report.txt")||!std::filesystem::file_size(archive/"audio-report.txt"))))
    throw std::runtime_error("Cannot preserve restart session reports");
  throw;
}}catch(const std::exception&e){forja65Fatal(e.what());std::ofstream qa("forja65-qa-status.txt",std::ios::trunc);if(qa)qa<<"FORJA65_QA 1\nruntime_started=FAIL\nerror="<<e.what()<<"\n";return 2;}return 0;}

int main(){
#ifdef _WIN32
 if(!std::filesystem::exists("assets/cart-data.bin")){wchar_t file[32768]{};if(GetModuleFileNameW(nullptr,file,32768)){auto dir=std::filesystem::path(file).parent_path();SetCurrentDirectoryW(dir.c_str());}}
#endif
 forja65ApplyStartupDefaults();return forja65RunRestartable(
  [](bool allowCheckpoint){return runSession(allowCheckpoint);},
  [](){
    forja65_interpreter_reset_observations();
#ifdef _WIN32
    // DestroyWindow posts WM_QUIT; it belongs to the old session only.
    MSG msg{};while(PeekMessage(&msg,nullptr,WM_QUIT,WM_QUIT,PM_REMOVE)){}
#endif
  });}
