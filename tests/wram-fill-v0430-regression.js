'use strict';
const C=require('../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=C.loadRom(C.makeSyntheticRom()),files=C.generateProject(rom,C.analyze(rom,128));
const dispatch=files['src/dispatch.cpp'],start=dispatch.indexOf('static bool forja65_try_wram_transfer'),end=dispatch.indexOf('\nvoid forja65_dispatch',start);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-fill-v0430-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
 fs.writeFileSync(path.join(dir,'test.cpp'),String.raw`#include "runtime.hpp"
#include <cassert>
#include <iostream>
${dispatch.slice(start,end)}
void init(CpuState&c,SnesRuntime&h,bool m8,std::uint8_t db=0){c.e=false;c.m8=m8;c.x8=true;c.db=db;c.pb=0x7F;c.s=0x1FF;c.a=0xAB01;c.i=true;h.headless=true;h.ppu.forceBlank=true;c.push8Value(h,0);c.push16Value(h,0x8080);h.pushNativeReturn(0x8081,true,c);}
void code(SnesRuntime&h,std::initializer_list<std::uint8_t> bytes){std::copy(bytes.begin(),bytes.end(),h.ram.begin()+0x18000);}
int main(){
 {SnesRuntime h;CpuState c;init(c,h,false);code(h,{0xA9,0x34,0x92,0x8D,0x00,0x04,0x9C,0x17,0x04,0x8D,0x31,0x04,0x6B});h.ram[0x417]=h.ram[0x418]=0xFF;
  assert(forja65_try_wram_stores_rtl(c,h,0x7F8000,true));assert(h.ram[0x400]==0x34&&h.ram[0x401]==0x92&&h.ram[0x417]==0&&h.ram[0x418]==0&&h.ram[0x431]==0x34&&h.ram[0x432]==0x92);assert(c.a==0x9234&&c.n&&!c.z&&c.s==0x1FF&&h.nativeReturns.empty()&&h.wramStoreContinuations.empty());assert(h.cpuInstructionCount==5&&h.cpuMasterClock==188);}
 {SnesRuntime h;CpuState c;init(c,h,true,0x7E);code(h,{0xA9,0x00,0x8D,0x00,0x80,0x8D,0x17,0x80,0x6B});assert(forja65_try_wram_stores_rtl(c,h,0x7F8000,true));assert(h.ram[0x8000]==0&&h.ram[0x8017]==0&&c.a==0xAB00&&c.z&&!c.n);}
 {SnesRuntime h;CpuState c;init(c,h,false,0x7E);code(h,{0x9C,0x00,0x90,0x6B});h.ram[0x9000]=h.ram[0x9001]=0xFF;c.n=true;c.z=false;assert(forja65_try_wram_stores_rtl(c,h,0x7F8000,true));assert(h.ram[0x9000]==0&&h.ram[0x9001]==0&&c.a==0xAB01&&c.n&&!c.z);}
 {SnesRuntime h;CpuState c;init(c,h,false,0x7F);code(h,{0xA9,0x55,0xAA,0x8D,0x00,0x90,0x6B});assert(forja65_try_wram_stores_rtl(c,h,0x7F8000,true));assert(h.ram[0x19000]==0x55&&h.ram[0x19001]==0xAA);}
 // Entire program must validate before registers, memory, stack or time change.
 for(unsigned bad:{0u,1u,2u,3u}){SnesRuntime h;CpuState c;init(c,h,false);code(h,{0xA9,0x55,0xAA,0x8D,0x00,0x04,0x8D,0x00,0x21,0x6B});if(bad==1){h.ram[0x18008]=0x04;h.ram[0x18009]=0x60;}if(bad==2)c.db=0x40;if(bad==3){h.ram[0x18007]=0x00;h.ram[0x18008]=0x80;c.db=0x7F;}auto clock=h.cpuMasterClock;assert(!forja65_try_wram_stores_rtl(c,h,0x7F8000,true));assert(h.cpuMasterClock==clock&&c.a==0xAB01&&h.ram[0x400]==0&&h.wramStoreContinuations.empty());}
 // 16-bit access must not cross from the low WRAM mirror to I/O.
 {SnesRuntime h;CpuState c;init(c,h,false);code(h,{0xA9,0x55,0xAA,0x8D,0xFF,0x1F,0x6B});assert(!forja65_try_wram_stores_rtl(c,h,0x7F8000,true));}
 // No untracked entry and no self-overwrite or destruction of return stack.
 {SnesRuntime h;CpuState c;init(c,h,true);code(h,{0xA9,0x55,0x8D,0xFD,0x01,0x6B});assert(!forja65_try_wram_stores_rtl(c,h,0x7F8000,true));assert(!forja65_try_wram_stores_rtl(c,h,0x7F8000,false));}
 {SnesRuntime h;CpuState c;init(c,h,false);code(h,{0xA9,0x55,0xAA,0x8D,0x00,0x04,0x6B});h.io.nmiEnable=true;h.cpuNmiInterruptPending=true;assert(forja65_try_wram_stores_rtl(c,h,0x7F8000,true)&&h.dispatchPending);auto pc=c.returnInterrupt(h);h.dispatchPending=false;c.m8=true;assert(!forja65_try_wram_stores_rtl(c,h,pc,false));c.m8=false;h.ram[0x18001]=0x66;assert(!forja65_try_wram_stores_rtl(c,h,pc,false));h.ram[0x18001]=0x55;assert(forja65_try_wram_stores_rtl(c,h,pc,false));assert(h.ram[0x400]==0x55&&h.ram[0x401]==0xAA&&c.s==0x1FF);}
 // Long-call authority must survive a pending interrupt before a tail jump.
 for(bool irq:{false,true}){SnesRuntime h;CpuState c;init(c,h,true);code(h,{0x4C,0x00,0x90});std::uint8_t fill[]={0xA9,0x77,0x8D,0x00,0x04,0x6B};std::copy(std::begin(fill),std::end(fill),h.ram.begin()+0x19000);c.i=!irq;h.io.nmiEnable=!irq;h.cpuNmiInterruptPending=!irq;h.cpuIrqInterruptPending=irq;
  assert(forja65_try_wram_transfer(c,h,0x7F8000,true)&&h.dispatchPending);auto pc=c.returnInterrupt(h);h.dispatchPending=false;h.cpuIrqInterruptPending=false;assert(pc==0x7F8000&&h.wramTailAuthorized(pc,c));assert(forja65_try_wram_transfer(c,h,pc,false));assert(h.dispatchTarget==0x7F9000);h.dispatchPending=false;assert(forja65_try_wram_stores_rtl(c,h,0x7F9000,false));assert(h.ram[0x400]==0x77&&c.s==0x1FF&&h.wramTailAuthorizations.empty()&&h.nativeReturns.empty());}
 // SRAM overlays must be rejected without reading the pointer.
 {SnesRuntime h;CpuState c;init(c,h,true);h.cart.assign(0x8000,0);h.sram.assign(0x8000,0);h.ram[0x1000]=0x5C;h.ram[0x1001]=0;h.ram[0x1002]=0x04;h.ram[0x1003]=0x70;assert(!forja65_try_wram_transfer(c,h,0x001000,false));}
 // A mirrored code address cannot silently run through $2000 into I/O.
 {SnesRuntime h;CpuState c;init(c,h,true);std::uint8_t bytes[]={0xA9,0x12,0x8D,0x00,0x04,0x6B};std::copy(std::begin(bytes),std::end(bytes),h.ram.begin()+0x1FFC);assert(!forja65_try_wram_stores_rtl(c,h,0x001FFC,true));}
 std::cout<<"WRAM_FILL_V0430_PASS width=8/16 mixed=STA/STZ banks=00/7E/7F guards=state/bytes/IO/code/stack/mirror\n";
}
`);
 cp.execFileSync('g++',['-std=c++20','-O0','-Wall','-Wextra','-Wpedantic','-Werror','test.cpp','-o','test'],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(path.join(dir,'test'),[],{cwd:dir,stdio:'inherit'});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
