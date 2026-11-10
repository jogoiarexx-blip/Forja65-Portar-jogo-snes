'use strict';
const assert=require('node:assert/strict'),F=require('../forja65-core'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
function fixture({clobber=false,badReturn=false,m8=false,x8=false,badTable=false}={}){
 const b=F.makeSyntheticRom(),start=0x8020,base=0x8034,count=83,end=base+count*2;
 // Prepare X from a byte, then compute A separately without changing X.
 b.set([0x29,0xff,0,0x0a,0xaa,0x98,0xeb,0x29,0xff,0,0x0a,0xa4,0x70,0xfc,base&255,base>>>8,0xa6,0x70,0x6b,0xea],start-0x8000);
 // Table follows LDX dp ; RTL exactly (one byte filler is invalid).
 const actualBase=base-1;b[start-0x8000+14]=actualBase&255;b[start-0x8000+15]=actualBase>>>8;
 b.set([0x18,0xfb,0xc2,0x30,0x22,0x20,0x80,0,0xdb],0);
 const expected=[];for(let n=0;n<count;n++){const t=actualBase+2*count+n*4;expected.push(t);b[actualBase-0x8000+n*2]=t&255;b[actualBase-0x8000+n*2+1]=t>>>8;b.set([0xa9,n,0,0x60],t-0x8000);}
 if(clobber)b[start-0x8000+11]=0xa6;
 if(badReturn)b[start-0x8000+18]=0xea;
 if(badTable){b[actualBase-0x8000+12]=0;b[actualBase-0x8000+13]=0;}
 const rom=F.loadRom(b,'inline-call.sfc'),pack={schema:'forja65.knowledge.v1',entries:[{address:start,state:{emulation:false,m8,x8,carry:null}}]};
 const q=F.focusAnalyze(rom,[start],pack).results[0];return {rom,site:q.indirect_sites.find(x=>x.pc===start+13),expected};
}
const q=fixture();assert(q.site,'indexed call table after the return stub must be discovered without hints');assert.deepEqual(q.site.targets,q.expected);assert.equal(q.site.resolution.entries,83);assert.equal(q.site.resolution.index_bounds_proven,false);
for(const o of [{clobber:true},{badReturn:true},{m8:true},{x8:true},{badTable:true}])assert(!fixture(o).site,JSON.stringify(o));
console.log('INLINE_INDEXED_CALL_V0396_PASS targets=83 guards=5');

const files=F.generateProject(q.rom,F.analyze(q.rom,4096)),dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-inline-call-'));
try{
 for(const [n,v] of Object.entries(files))if(n.startsWith('src/')||n==='assets/cart-data.bin'){fs.mkdirSync(path.dirname(path.join(dir,n)),{recursive:true});fs.writeFileSync(path.join(dir,n),v);}
 fs.writeFileSync(path.join(dir,'probe.cpp'),`#include "generated.hpp"
#include <iostream>
int main(){for(unsigned n:{0u,64u,82u}){SnesRuntime h("assets/cart-data.bin",MapperKind::LoROM);CpuState c;c.e=false;c.m8=false;c.x8=false;c.c=true;c.pb=0;c.s=0x1ff;c.a=n;c.y=0xaabb;h.ram[0x70]=0x55;
c.push8Value(h,0);c.push16Value(h,0);h.pushNativeReturn(1,true,c);try{forja65_dispatch(c,h,0x8020,0xfffffe);}catch(const std::exception&e){std::cerr<<e.what();return 2;}
if(c.a!=n||c.x!=0x55||c.y!=0x55||c.s!=0x1ff||!h.nativeReturns.empty())return 3;}std::cout<<"INLINE_INDEXED_CALL_EXECUTION_PASS first middle last stack-balanced\\n";}
`);
 const sources=Object.keys(files).filter(n=>/^src\/generated_.*cpp$/.test(n)||n==='src/dispatch.cpp').map(n=>path.join(dir,n));
 cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-x','c++-header',path.join(dir,'src/runtime.hpp'),'-o',path.join(dir,'src/runtime.hpp.gch')],{stdio:'inherit'});
 cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-include',path.join(dir,'src/runtime.hpp'),'-I',path.join(dir,'src'),path.join(dir,'probe.cpp'),...sources,'-o',path.join(dir,'probe')],{stdio:'inherit'});
 cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,stdio:'inherit'});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
