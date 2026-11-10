'use strict';
const F=require(process.env.FORJA65_TEST_CORE||'../forja65-core'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,64)),dir=fs.mkdtempSync(path.join(os.tmpdir(),'mirrors143-'));
for(const[n,v]of Object.entries(files))if(n.startsWith('src/')&&n.endsWith('.hpp'))fs.writeFileSync(path.join(dir,path.basename(n)),v);
fs.writeFileSync(path.join(dir,'probe.cpp'),String.raw`#include "runtime.hpp"
#include <memory>
#include <cassert>
#include <cstring>
#include <iostream>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
int main(){auto h=std::make_unique<SnesRuntime>();h->headless=true;
for(unsigned bank:{0u,0x3fu,0x80u,0xbfu})for(unsigned off=0x2140;off<=0x217f;off++){unsigned port=off&3,addr=bank*65536+off;auto v=std::uint8_t(off+bank);h->apu.spc.portOut[port]=v;assert(h->read(addr)==v);assert(!std::strcmp(h->traceSpace(addr),"APU"));h->write8(addr,v^0x55);assert(h->apu.spc.portIn[port]==std::uint8_t(v^0x55));assert(h->apu.spc.portOut[port]==v);}
for(unsigned off=0x2140;off<=0x217f;off++){unsigned port=off&3;std::uint8_t v;h->apu.spc.portOut[port]=off&255;assert(h->nativeBbusRead(off,v)&&v==(off&255));assert(h->nativeBbusWrite(off,0xa0|port));assert(h->apu.spc.portIn[port]==(0xa0|port));}
std::uint8_t v;assert(!h->nativeBbusRead(0x2181,v));assert(!h->nativeBbusWrite(0x2181,1));assert(std::strcmp(h->traceSpace(0x402144),"APU"));auto old=h->apu.spc.portIn[0];h->write8(0x2180,0x77);assert(h->apu.spc.portIn[0]==old);std::cout<<"APU_PORT_MIRRORS_REV143_PASS all64 fourbanks native-Bbus latch-direction boundaries\n";}
`);
cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','probe.cpp','-o','probe'],{cwd:dir,stdio:'inherit'});cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,stdio:'inherit'});
