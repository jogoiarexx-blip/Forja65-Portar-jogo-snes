'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),C=require('../forja65-core');
// Missing automatic serial clocks exposes button B as the 17th signature bit,
// causing games that validate controller identity to ignore genuine input.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-autojoy-signature-'));
try{
 const rom=C.loadRom(C.makeSyntheticRom()),files=C.generateProject(rom,C.analyze(rom,128));
 for(const name of ['runtime.hpp','forja_trace.hpp','forja_ir.hpp'])fs.writeFileSync(path.join(dir,name),files['src/'+name]);
 fs.writeFileSync(path.join(dir,'test.cpp'),`#include "runtime.hpp"
#include <iostream>
int main(){SnesRuntime h;h.headless=true;h.setJoy1(0x0200);h.setJoy2(0x0080);h.io.setNmitimen(1);
h.beginFrame();h.beginVblank();h.advanceCpuMasterCycles(5000);
if(h.readW(0x4218,16)!=0x0200||h.readW(0x421a,16)!=0x0080)return 2;
if((h.readBus(0x4016)&1)!=1||(h.readBus(0x4017)&1)!=1){std::cerr<<"automatic read did not consume 16 serial bits\\n";return 3;}
h.write8(0x4016,1);h.write8(0x4016,0);
unsigned word=0;for(int i=0;i<16;i++)word=(word<<1)|(h.readBus(0x4016)&1);
if(word!=0x0200||(h.readBus(0x4016)&1)!=1)return 4;
SnesRuntime clocked;clocked.headless=true;clocked.setJoy1(0x0400);clocked.io.setNmitimen(1);clocked.beginFrame();
clocked.advanceCpuMasterCycles(clocked.visibleLines()*SnesRuntime::MASTER_CYCLES_PER_SCANLINE+SnesRuntime::NMI_TRIGGER_MC);
if((clocked.readBus(0x4016)&1)!=1)return 6;
SnesRuntime manual;manual.headless=true;manual.setJoy1(0x8000);manual.io.setJoyStrobe(true);manual.io.setJoyStrobe(false);
manual.beginFrame();manual.beginVblank();if((manual.readBus(0x4016)&1)!=1||(manual.readBus(0x4016)&1)!=0)return 5;
std::cout<<"AUTO_JOY_SERIAL_SIGNATURE_PASS\\n";}
`);
 cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-I',dir,path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{stdio:'inherit'});
 cp.execFileSync(path.join(dir,'test'),[],{cwd:dir,stdio:'inherit'});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
