'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),F=require('../forja65-core');
const r=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(r,F.analyze(r,64));
assert(files['src/runtime.hpp'].includes('cpuInterpreterInstructions'),'fallback count must belong to runtime instance');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-audit142-'));
for(const [n,c]of Object.entries(files))if(n.startsWith('src/')&&n.endsWith('.hpp'))fs.writeFileSync(path.join(dir,path.basename(n)),c);
fs.writeFileSync(path.join(dir,'interpreter.cpp'),files['src/forja_cpu_interpreter.cpp']);
fs.writeFileSync(path.join(dir,'probe.cpp'),String.raw`#include "forja_checkpoint.hpp"
#include <cassert>
#include <memory>
#include <iostream>
ForjaInterpreterHooks forja65_interpreter_hooks{};
bool forja65_is_stack_return_target(std::uint32_t,SnesRuntime&){return true;}
void forja65_dispatch(CpuState&c,SnesRuntime&h,std::uint32_t pc,std::uint32_t){
 if(pc==0x200){h.traceInstruction(pc,c,0xea);h.traceInstruction(pc+1,c,0xea);throw std::runtime_error("native-callee-done");}
}
void forja65_wait(CpuState&,SnesRuntime&,std::uint32_t){throw std::runtime_error("unexpected WAI in audit probe");}
std::string report(SnesRuntime&h){h.writeNativeDependencyReport("audit.txt");std::ifstream f("audit.txt");return {(std::istreambuf_iterator<char>(f)),{}};}
int main(){auto h=std::make_unique<SnesRuntime>();h->headless=true;CpuState c;c.e=c.m8=c.x8=true;
 h->ram[0x100]=0xea;h->ram[0x101]=0xea;h->ram[0x102]=0xdb;
 auto no=[](SnesRuntime&,std::uint32_t,const CpuState&){return false;};
 forja65_interpreter_hooks.interpret(c,*h,0x100,0x100,no);
 assert(h->cpuInterpreterInstructions==3);assert(h->cpuInstructionCount==3);
 auto s=report(*h);assert(s.find("CPU_FULLY_NATIVE=NO")!=std::string::npos);assert(s.find("cpu_interpreter_instructions=3")!=std::string::npos);assert(s.find("cpu_aot_instructions=0")!=std::string::npos);
 auto h2=std::make_unique<SnesRuntime>();assert(h2->cpuInterpreterInstructions==0);
 h2->cpuInstructionCount=4;s=report(*h2);assert(s.find("CPU_FULLY_NATIVE=YES")!=std::string::npos);assert(s.find("cpu_aot_instructions=4")!=std::string::npos);
 auto wai=std::make_unique<SnesRuntime>();wai->headless=true;wai->ram[0x100]=0xcb;
 bool yielded=false;try{forja65_interpreter_hooks.interpret(c,*wai,0x100,0x100,no);}catch(const std::runtime_error&){yielded=true;}
 assert(yielded&&wai->cpuInstructionCount==1&&wai->cpuInterpreterInstructions==1);
 auto pending=std::make_unique<SnesRuntime>();pending->headless=true;pending->frameCounter=2;pending->hostFrameReady=true;pending->ram[0x100]=0xea;
 try{forja65_interpreter_hooks.interpret(c,*pending,0x100,0x100,no);}catch(const std::runtime_error&){}
 assert(pending->cpuInstructionCount==0&&pending->cpuInterpreterInstructions==0);
 #if !FORJA65_STACKLESS_CALLS
 auto nested=std::make_unique<SnesRuntime>();nested->headless=true;
 nested->ram[0x100]=0x20;nested->ram[0x101]=0;nested->ram[0x102]=2;
 try{forja65_interpreter_hooks.interpret(c,*nested,0x100,0x100,no);}catch(const std::runtime_error&){}
 assert(nested->cpuInstructionCount==3&&nested->cpuInterpreterInstructions==1);
#endif
 h->stopped=false;forja_checkpoint::save("audit.f65s",c,*h);forja_checkpoint::load("audit.f65s",c,*h2);assert(h2->cpuInterpreterInstructions==3);
 std::cout<<"CPU_NATIVE_AUDIT_REV142_PASS fallback-count fully-native-gate instance-isolation checkpoint\n";}
`);
for(const mode of [1,0]){
cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-DFORJA65_STACKLESS_CALLS='+mode,'-include','generated.hpp','probe.cpp','interpreter.cpp','-o','probe'],{cwd:dir,stdio:'inherit'});
cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,stdio:'inherit'});

}
