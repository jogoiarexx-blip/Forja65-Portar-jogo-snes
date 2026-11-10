'use strict';
const F=require('../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'spc-backend145-'));
try{
 const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,64));
 for(const[n,v]of Object.entries(files))if(n.startsWith('src/')&&n.endsWith('.hpp'))fs.writeFileSync(path.join(root,path.basename(n)),v);
 fs.writeFileSync(path.join(root,'probe.cpp'),String.raw`#include "runtime.hpp"
#include <cassert>
#include <sstream>
#include <memory>
#include <iostream>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
void tick(ApuBridge&,unsigned){}
int instruction(ApuBridge&){return 2;}
int main(){auto a=std::make_unique<ApuBridge>();const char* expected[]={"interpreter","linked_hook","aot_opcode","linked_hook"};for(unsigned mode=0;mode<4;mode++){
 a->nativeStepHook=(mode&1)?tick:nullptr;a->nativeInstructionHook=(mode&2)?instruction:nullptr;
 const auto pc=a->spc.pc;const auto clock=a->masterObserved;std::ostringstream out;a->writeSpcConfiguration(out);
 assert(out.str().find(std::string("spc_backend=")+expected[mode]+"\n")!=std::string::npos);assert(a->spc.pc==pc&&a->masterObserved==clock);
}std::cout<<"SPC_BACKEND_REPORT_REV145_PASS interpreter step instruction precedence passive\n";}
`);
 cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','probe.cpp','-o','probe'],{cwd:root,stdio:'inherit'});
 cp.execFileSync(path.join(root,'probe'),{cwd:root,stdio:'inherit'});
}finally{fs.rmSync(root,{recursive:true,force:true});}
