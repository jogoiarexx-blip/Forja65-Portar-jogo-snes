'use strict';
// Execute the generated C++ across PB:FFFF, rather than only inspecting the CFG.
const C=require('../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const r=C.loadRom(C.makeSyntheticRom());r.header.mapping=C.MAP.HIROM;r.data=new Uint8Array(0x20000);r.data.fill(0xdb);
r.data.set([0x4c,0xff,0xff],0xffd0);r.data[0xffff]=0xa9;r.data.set([0x42,0x85,0x10,0xdb],0);r.data[0x10000]=0x99;
const a=C.analyze(r,128,[{target:0xc0ffd0,state:{emulation:false,m8:true,x8:true,carry:null},kind:'STATE',from:null}]);
const files=C.generateProject(r,a),dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-bank-execute-'));
try{
 for(const [n,v] of Object.entries(files)){const f=path.join(dir,n);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v instanceof Uint8Array?Buffer.from(v):v);}
 fs.writeFileSync(path.join(dir,'probe.cpp'),`#include "generated.hpp"
#include <memory>
#include <iostream>
int main(){auto h=std::make_unique<SnesRuntime>();h->mapper=MapperKind::HiROM;h->loadCart("assets/cart-data.bin");CpuState c;c.e=false;c.m8=true;c.x8=true;c.pb=0xc0;forja65_dispatch(c,*h,0xc0ffd0,0xc0ffd0);if(!h->stopped||h->ram[0x10]!=0x42||c.pb!=0xc0){std::cerr<<"generated bank-wrap failed A="<<c.a<<" value="<<unsigned(h->ram[0x10])<<" PB="<<unsigned(c.pb)<<'\\n';return 1;}std::cout<<"CFG_CPU_BANK_EXECUTION_V043616_PASS operand=42 store=42 pb=C0 stopped=1\\n";}
`);
 const sources=Object.keys(files).filter(n=>/^src\/generated_.*\.cpp$/.test(n));
 const bin=path.join(dir,process.platform==='win32'?'probe.exe':'probe');
 const args=['-std=c++20','-O0','-Isrc','probe.cpp','src/dispatch.cpp','src/native_hooks.cpp',...sources,'-o',bin];
 if(process.platform==='win32')args.push('-luser32','-lgdi32','-lxinput9_1_0','-lwinmm');
 cp.execFileSync(process.env.CXX||'g++',args,{cwd:dir,stdio:'inherit'});
 cp.execFileSync(bin,[],{cwd:dir,stdio:'inherit'});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
