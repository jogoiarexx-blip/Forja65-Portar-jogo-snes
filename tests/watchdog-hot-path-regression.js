const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('assert'),C=require('../forja65-core');
const files=C.generateProject(C.loadRom(C.makeSyntheticRom()),C.analyze(C.loadRom(C.makeSyntheticRom()),128)),dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-watchdog-'));
for(const [n,v]of Object.entries(files)){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
fs.writeFileSync(path.join(dir,'probe.cpp'),String.raw`#include "src/runtime.hpp"
#include <cassert>
#include <cstring>
#include <iostream>
static unsigned queries=0;
extern "C" char* __real_getenv(const char*);
extern "C" char* __wrap_getenv(const char*n){if(std::strcmp(n,"FORJA65_WATCHDOG_INSTRUCTIONS")==0)queries++;return __real_getenv(n);}
int main(){setenv("FORJA65_WATCHDOG_INSTRUCTIONS","101",1);SnesRuntime hw;CpuState cpu;unsigned before=queries;for(unsigned i=0;i<100;i++)hw.traceInstruction(0x8000,cpu);unsigned delta=queries-before;std::cout<<"queries_in_loop="<<delta<<std::endl;assert(delta<=1);bool stopped=false;try{hw.traceInstruction(0x8000,cpu);}catch(const std::runtime_error&){stopped=true;}assert(stopped&&hw.cpuInstructionCount==101);}
`);
cp.execFileSync('g++',['-std=c++20','-O1','probe.cpp','-Wl,--wrap=getenv','-o','probe'],{cwd:dir});
const r=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,encoding:'utf8'});console.log(r.stdout.trim());assert.equal(r.status,0,r.stderr);console.log('watchdog-hot-path-regression: OK (bounded environment queries, exact instruction limit)');
