'use strict';
const C=require('../forja65-core'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('node:assert/strict');
const d=C.makeSyntheticRom();d.set([0x20,0x00,0x81,0xE6,0x10,0x60],0);d.set([0x20,0x00,0x82,0xE6,0x11,0x60],0x100);d.set([0x68,0x68,0x60],0x200);d.set([0xDB],0x30);
const rom=C.loadRom(d,'nonlocal-return.sfc'),a=C.analyze(rom,512);a.syntheticReturnTargets=[0x8003];const p=C.generateProject(rom,a),out=fs.mkdtempSync(path.join(os.tmpdir(),'forja-nonlocal-'));
try{
 for(const[n,v]of Object.entries(p))if(n.startsWith('src/')||n==='assets/cart-data.bin'){fs.mkdirSync(path.dirname(path.join(out,n)),{recursive:true});fs.writeFileSync(path.join(out,n),v);}
 fs.writeFileSync(path.join(out,'test.cpp'),`#include "generated.hpp"
#include <iostream>
int main(){SnesRuntime h("assets/cart-data.bin",MapperKind::LoROM);CpuState c;c.enforceEmulation();c.push16Value(h,0x802f);h.pushNativeReturn(0x8030,false,c);
try{forja65_dispatch(c,h,0x8000,0);}catch(const std::exception&e){std::cerr<<"resumed abandoned C++ caller: "<<e.what()<<"\\n";return 2;}
if(c.s!=0x1ff||h.ram[0x10]!=1||h.ram[0x11]!=0||!h.nativeReturns.empty()){std::cerr<<"nonlocal hardware return resumed wrong continuation\\n";return 3;}
std::cout<<"nonlocal call continuation PASS\\n";}
`);
 const sources=Object.keys(p).filter(n=>/^src\/generated_.*cpp$/.test(n)||n==='src/dispatch.cpp').map(n=>path.join(out,n));
 cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-I',path.join(out,'src'),path.join(out,'test.cpp'),...sources,'-o',path.join(out,'test')],{stdio:'inherit'});
 const q=cp.spawnSync(path.join(out,'test'),[],{cwd:out,encoding:'utf8'});process.stdout.write(q.stdout);process.stderr.write(q.stderr);assert.equal(q.status,0,'Nonlocal RTS must abandon the consumed C++ callers');
}finally{fs.rmSync(out,{recursive:true,force:true});}
