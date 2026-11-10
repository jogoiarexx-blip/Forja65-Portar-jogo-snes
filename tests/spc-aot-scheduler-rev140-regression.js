'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),F=require('../forja65-core');
const ram=new Uint8Array(65536);
// MOV A,#5; MOV Y,#3; MUL YA; MOV $10,A; BRA entry.
ram.set([0xe8,5,0x8d,3,0xcf,0xc4,0x10,0x2f,0xf7],0x200);
const cap=F.loadSpcCapture(ram,'entry_candidate=512'),a=F.spcAnalyze(cap,64),files=F.generateSpcProject(cap,a);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'spc-aot-rev140-'));
try{
 for(const n of ['runtime.hpp','pcm_audio_output.hpp','spc700_native.cpp'])fs.writeFileSync(path.join(dir,n),files[n]);
 const rom=F.loadRom(F.makeSyntheticRom());const cpuFiles=F.generateProject(rom,F.analyze(rom,64));
 for(const [name,content]of Object.entries(cpuFiles))if(name.startsWith('src/')&&name.endsWith('.hpp'))fs.writeFileSync(path.join(dir,path.basename(name)),content);
 fs.writeFileSync(path.join(dir,'probe.cpp'),String.raw`#include "forja_checkpoint.hpp"
#include <cassert>
#include <iostream>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
int forja65_native_spc_instruction(ApuBridge&);
void forja65_native_spc_tick(ApuBridge&,unsigned);
void init(ApuBridge&a,bool native,bool pal){
 a.setClockRegion(pal);a.correctedSpcSemantics=true;a.accurateSpcTiming=true;
 a.strictSpcScheduler=true;a.ntscSpcClock=true;a.interleaveSpcDsp=true;
 a.spc.control=0;a.spc.pc=0x200;
 const unsigned char code[]={0xe8,5,0x8d,3,0xcf,0xc4,0x10,0x2f,0xf7};
 std::copy(std::begin(code),std::end(code),a.spc.ram.begin()+0x200);
 if(native)a.setNativeInstructionHook(&forja65_native_spc_instruction);
}
void equal(const ApuBridge&a,const ApuBridge&b){
 assert(a.spc.pc==b.spc.pc&&a.spc.ya==b.spc.ya&&a.spc.psw==b.spc.psw);
 assert(a.spc.ram==b.spc.ram&&a.spcExecutedCycles==b.spcExecutedCycles);
 assert(a.ntscCycleCredit==b.ntscCycleCredit&&a.dspMasterRemainder==b.dspMasterRemainder);
 for(int i=0;i<3;i++)assert(a.spc.timerOut[i]==b.spc.timerOut[i]);
}
int main(){
 {SnesRuntime h;init(h.apu,true,false);h.apu.spc.ram[0x200]=0xcd;h.apu.tickMasterCycles(200);
  assert(h.apu.spcAotMisses>0);h.writeNativeDependencyReport("audit.txt");
  std::ifstream f("audit.txt");const std::string report((std::istreambuf_iterator<char>(f)),{});
  assert(report.find("APU_VIRTUAL_HW=YES")!=std::string::npos);}
 for(bool pal:{false,true}){
  ApuBridge a,b,c;init(a,true,pal);init(b,false,pal);init(c,true,pal);
  a.tickMasterCycles(12000);for(unsigned i=0;i<12000;i++)b.tickMasterCycles(1);
  unsigned left=12000;while(left){unsigned n=std::min(left,137u);c.tickMasterCycles(n);left-=n;}
  equal(a,b);equal(a,c);assert(a.spcAotInstructions>0&&a.spcAotMisses==0);
  assert(a.spc.ram[0x10]==15);
  // A changed operand is read live; no stale immediate from the capture.
  a.spc.pc=b.spc.pc=0x200;a.spc.ram[0x201]=b.spc.ram[0x201]=7;
  a.tickMasterCycles(5000);b.tickMasterCycles(5000);equal(a,b);
  // A changed opcode must fall back safely using the same state and clock.
  a.spc.pc=b.spc.pc=0x200;a.spc.ram[0x200]=b.spc.ram[0x200]=0xcd;
  a.tickMasterCycles(5000);b.tickMasterCycles(5000);equal(a,b);assert(a.spcAotMisses>0);assert(a.spcAotExecutedCycles+a.spcInterpreterExecutedCycles==a.spcExecutedCycles);assert(a.spcInterpreterExecutedCycles>0);
  // The legacy adapter must not count the same master interval twice.
  ApuBridge legacy,reference;init(legacy,false,pal);init(reference,false,pal);
  legacy.setNativeStepHook(&forja65_native_spc_tick);
  legacy.tickMasterCycles(12000);reference.tickMasterCycles(12000);
  equal(legacy,reference);assert(legacy.masterObserved==12000&&legacy.nativeMasterCycles==12000);
  // Native state survives real checkpoint save/load and continues identically.
  {CpuState cpu;SnesRuntime source,resumed;source.headless=resumed.headless=true;
   source.regionCode=resumed.regionCode=pal?2:1;init(source.apu,true,pal);init(resumed.apu,true,pal);
   source.advanceCpuMasterCycles(12000);forja_checkpoint::save("native.f65s",cpu,source);
   forja_checkpoint::load("native.f65s",cpu,resumed);source.advanceCpuMasterCycles(5000);resumed.advanceCpuMasterCycles(5000);
   assert(forja_checkpoint::encode(cpu,source)==forja_checkpoint::encode(cpu,resumed));}
  // Native backend state belongs to each APU instance.
  ApuBridge independent;init(independent,true,pal);assert(independent.spcExecutedCycles==0&&independent.spc.pc==0x200);
 }
 std::cout<<"SPC_AOT_SCHEDULER_REV140_PASS ntsc/pal batch=single=irregular operand-change opcode-fallback instance-isolation\n";
}`);
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra','-Werror','probe.cpp','spc700_native.cpp','-o','probe'],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,stdio:'inherit'});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
