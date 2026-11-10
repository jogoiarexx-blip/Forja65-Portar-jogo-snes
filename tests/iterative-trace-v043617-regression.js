'use strict';
const C=require('../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const r=C.loadRom(C.makeSyntheticRom());r.data.set([0x20,0x00,0x81,0xdb],0);r.data.set([0x20,0x00,0x82,0x60],0x100);r.data.set([0xea,0x60],0x200);
const p=C.generateProject(r,C.analyze(r,256)),dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-iterative-trace-'));
try{for(const[n,v]of Object.entries(p))if(n.startsWith('src/')||n==='assets/cart-data.bin'){const f=path.join(dir,n);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}
fs.writeFileSync(path.join(dir,'probe.cpp'),`#include "generated.hpp"
#include <memory>
int main(){auto h=std::make_unique<SnesRuntime>();h->loadCart("assets/cart-data.bin");h->trace.start("flow.csv","test");CpuState c;forja65_dispatch(c,*h,0x8000,0);h->trace.close();return h->stopped&&h->nativeReturns.empty()&&c.s==0x1ff?0:1;}
`);
const files=Object.keys(p).filter(n=>/^src\/generated_.*\.cpp$/.test(n)||n==='src/dispatch.cpp'||n==='src/native_hooks.cpp');
const args=['-std=c++20','-O0','-Isrc','probe.cpp',...files,'-o','probe'];if(process.platform==='win32')args.push('-luser32','-lgdi32','-lxinput9_1_0','-lwinmm');cp.execFileSync(process.env.CXX||'g++',args,{cwd:dir,stdio:'inherit'});cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,stdio:'inherit'});
const entries=fs.readFileSync(path.join(dir,'flow.csv'),'utf8').split('\n').map(x=>x.split(',')).filter(x=>x[4]==='entry');
assert(entries.some(x=>Number(x[2])===0x8100&&Number(x[7])===0x8000),'root-to-child trace must preserve parent routine');
assert(entries.some(x=>Number(x[2])===0x8200&&Number(x[7])===0x8100),'nested call trace must preserve parent routine');
console.log('ITERATIVE_TRACE_V043617_PASS parent=8000 child=8100 grandchild=8200 stack=1FF');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
