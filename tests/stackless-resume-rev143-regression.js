'use strict';
const F=require(process.env.FORJA65_TEST_CORE||'../forja65-core'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const d=F.makeSyntheticRom();d.fill(0xea,0,0x7fc0);d.set([0x18,0xfb,0xc2,0x30,0x20,0,0x90,0x22,0,0xa0,0,0xa9,0xef,0xbe,0x85,0x10,0xdb],0);d[0x1000]=0x60;d[0x2000]=0x6b;
const rom=F.loadRom(d),files=F.generateProject(rom,F.analyze(rom,256));if(!files['src/main.cpp'].includes('if(haveResume||hw.checkpointCaptured){extern void forja65_dispatch_restored'))throw Error('Generated checkpoint main must resume restored calls');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'resume143-'));
for(const[n,v]of Object.entries(files)){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
fs.writeFileSync(path.join(dir,'src/main.cpp'),String.raw`#include "forja_checkpoint.hpp"
#include <memory>
#include <cassert>
#include <iostream>
void forja65_dispatch_restored(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t);
int main(){for(bool longCall:{false,true}){auto h=std::make_unique<SnesRuntime>();h->headless=true;CpuState c;c.e=false;c.m8=false;c.x8=false;c.c=true;c.s=0x1ff;c.pb=0;if(longCall)c.push8Value(*h,0,true);c.push16Value(*h,longCall?0x800a:0x8006,longCall);h->pushNativeReturn(longCall?0x800b:0x8007,longCall,c);
// Serialize and restore live calls, then enter a new root dispatcher.
auto payload=forja_checkpoint::encode(c,*h);auto restored=std::make_unique<SnesRuntime>();CpuState cpu;forja_checkpoint::decode(payload,cpu,*restored);restored->headless=true;
forja65_dispatch_restored(cpu,*restored,longCall?0x00a000:0x009000,0);assert(restored->ram[0x10]==0xef&&restored->ram[0x11]==0xbe);assert(cpu.s==0x1ff);assert(restored->nativeReturns.empty());}std::cout<<"STACKLESS_RESUME_REV143_PASS short long serialized-live-calls continuation stack marker\n";}
`);
const src=path.join(dir,'src'),flags=['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-I'+src];cp.execFileSync('g++',[...flags,'-x','c++-header',path.join(src,'runtime.hpp'),'-o',path.join(src,'runtime.hpp.gch')]);
const objs=[];for(const f of fs.readdirSync(src).filter(n=>n.endsWith('.cpp')&&n!=='forja_cpu_interpreter.cpp')){const o=path.join(dir,f+'.o');cp.execFileSync('g++',[...flags,'-include',path.join(src,'runtime.hpp'),'-c',path.join(src,f),'-o',o]);objs.push(o);}
const exe=path.join(dir,'probe');cp.execFileSync('g++',[...objs,'-o',exe]);cp.execFileSync(exe,[],{cwd:dir,stdio:'inherit',timeout:10000,env:{...process.env,FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:'0'}});
