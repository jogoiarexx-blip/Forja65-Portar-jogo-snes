'use strict';
const F=require('../forja65-core'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('node:assert/strict');
const b=F.makeSyntheticRom();
b.set([0x18,0xfb,0xc2,0x30,0x08,0xf4,0x0a,0x80,0x6c,0x42,0x00,0xa9,0x55,0x85,0x10,0x28,0xa9,0x34,0x12,0x85,0x12,0xdb],0);
b.set([0xe2,0x20,0x60],0x100);
const rom=F.loadRom(b,'callback-execution.sfc'),hints=F.parseRuntimeHints(`rom=${F.romFingerprint(rom)} target=008100 from=008008 kind=FLOW e=0 m=0 x=0 c=1`);
const p=F.generateProject(rom,F.analyze(rom,512,hints)),d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-callback-'));
try{
 for(const[n,v]of Object.entries(p))if(n.startsWith('src/')||n==='assets/cart-data.bin'){fs.mkdirSync(path.dirname(path.join(d,n)),{recursive:true});fs.writeFileSync(path.join(d,n),v);}
 fs.writeFileSync(path.join(d,'test.cpp'),`#include "generated.hpp"
#include <iostream>
int main(){SnesRuntime h("assets/cart-data.bin",MapperKind::LoROM);CpuState c;c.enforceEmulation();h.ram[0x42]=0;h.ram[0x43]=0x81;
try{forja65_dispatch(c,h,0x8000,0);}catch(const std::exception&e){std::cerr<<e.what()<<"\\n";return 2;}
if(h.ram[0x10]!=0x55||h.ram[0x11]!=0||h.ram[0x12]!=0x34||h.ram[0x13]!=0x12||c.s!=0x1ff||!h.nativeReturns.empty()){std::cerr<<"callback state/stack corrupted\\n";return 3;}
std::cout<<"OBSERVED_CALLBACK_EXECUTION_V0394_PASS M8-immediate M16-restore stack-balanced\\n";}
`);
 const sources=Object.keys(p).filter(n=>/^src\/generated_.*cpp$/.test(n)||n==='src/dispatch.cpp').map(n=>path.join(d,n));
 cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-I',path.join(d,'src'),path.join(d,'test.cpp'),...sources,'-o',path.join(d,'test')],{stdio:'inherit'});
 const q=cp.spawnSync(path.join(d,'test'),[],{cwd:d,encoding:'utf8'});process.stdout.write(q.stdout);process.stderr.write(q.stderr);assert.equal(q.status,0,'Generated C++ must execute a state-changing RAM callback and restore PHP/PLP');
}finally{fs.rmSync(d,{recursive:true,force:true});}
