'use strict';
const C=require(process.env.FORJA_TEST_CORE||'../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const r=C.loadRom(C.makeSyntheticRom());r.data.set([0xa1,0xf7,0x85,0x10,0xab,0xdb],0);const p=C.generateProject(r,C.analyze(r,128)),dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-cpu-oracle-'));
try{for(const[n,v]of Object.entries(p))if(n.startsWith('src/')||n==='assets/cart-data.bin'){const f=path.join(dir,n);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}
fs.copyFileSync(path.join(__dirname,'reference/ares_micro_reference_v043618.hpp'),path.join(dir,'src/ares_micro_reference_v043618.hpp'));
fs.writeFileSync(path.join(dir,'probe.cpp'),`#include "generated.hpp"
#include "ares_micro_reference_v043618.hpp"
#include <memory>
#include <iostream>
int main(){auto h=std::make_unique<SnesRuntime>();h->loadCart("assets/cart-data.bin");CpuState c;c.e=true;c.m8=true;c.x8=true;c.a=0x5500;c.d=0x11a;c.x=0xee;c.s=0x1ff;c.db=0x7e;
upstream_ares_reference::AresCpuReference ref;ref.EF=true;ref.D.w=c.d;ref.S.w=c.s;ref.B=c.db;
for(unsigned a=0;a<8192;a++)h->ram[a]=ref.memory[a]=0;
h->ram[0x2ff]=ref.memory[0x2ff]=0x34;h->ram[0x200]=ref.memory[0x200]=0x12;h->ram[0x300]=ref.memory[0x300]=0x56;h->ram[0x1234]=ref.memory[0x1234]=0xab;h->ram[0x5634]=ref.memory[0x5634]=0xcd;h->ram[0x100]=ref.memory[0x100]=0x80;
const unsigned pointer=ref.readDirectX(0xf7+0xee,0)|(unsigned(ref.readDirectX(0xf7+0xee,1))<<8);const unsigned expectedA=0x5500|ref.read(pointer);ref.instructionPullB();forja65_dispatch(c,*h,0x8000,0);
if(c.a!=expectedA||c.s!=ref.S.w||c.db!=ref.B||c.z!=ref.ZF||c.n!=ref.NF||h->ram[0x12a]!=(expectedA&255)||c.x!=0xee||c.d!=0x11a||c.packP()!=0x34||!h->stopped){std::cerr<<"CPU_GENERATED_DIFFERENTIAL_FAIL A="<<std::hex<<c.a<<" DB="<<unsigned(c.db)<<" S="<<c.s<<'\\n';return 1;}std::cout<<"CPU_GENERATED_DIFFERENTIAL_V043618_PASS A=55AB DB=12 S=100 P=34 store=AB stopped=1\\n";}
`);
const sources=Object.keys(p).filter(n=>/^src\/generated_.*\.cpp$/.test(n)||n==='src/dispatch.cpp'||n==='src/native_hooks.cpp');let args=['-std=c++20','-O0','-Isrc','probe.cpp',...sources,'-o','probe'];if(process.platform==='win32')args.push('-luser32','-lgdi32','-lxinput9_1_0','-lwinmm');cp.execFileSync(process.env.CXX||'g++',args,{cwd:dir,stdio:'inherit'});const q=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,encoding:'utf8'});process.stdout.write(q.stdout||'');process.stderr.write(q.stderr||'');assert.equal(q.status,0,'generated opcode behavior must match the independently compiled ares micro-reference');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
