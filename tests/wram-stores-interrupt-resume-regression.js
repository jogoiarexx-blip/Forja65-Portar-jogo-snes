'use strict';
const C=require('../forja65-core'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const rom=C.loadRom(C.makeSyntheticRom()),files=C.generateProject(rom,C.analyze(rom,128));
const dispatch=files['src/dispatch.cpp'],start=dispatch.indexOf('static bool forja65_try_wram_stores_rtl'),end=dispatch.indexOf('\nvoid forja65_dispatch',start);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-wram-nmi-'));
fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
fs.writeFileSync(path.join(dir,'test.cpp'),`#include "runtime.hpp"
#include <cassert>
${dispatch.slice(start,end)}
void prepare(CpuState&cpu,SnesRuntime&hw){cpu.e=false;cpu.m8=true;cpu.x8=true;cpu.db=0;cpu.pb=0x7F;cpu.s=0x1FF;cpu.a=0xAB01;
 hw.ram[0x18000]=0xA9;hw.ram[0x18001]=0xF0;
 for(unsigned i=0;i<128;i++){auto p=0x18002+i*3;auto a=0x201+i*4;hw.ram[p]=0x8D;hw.ram[p+1]=a&255;hw.ram[p+2]=a>>8;}
 hw.ram[0x18182]=0x6B;cpu.push8Value(hw,0);cpu.push16Value(hw,0x8080);hw.pushNativeReturn(0x8081,true,cpu);hw.io.nmiEnable=true;}
int main(){
 SnesRuntime hw;CpuState cpu;prepare(cpu,hw);hw.cpuNmiInterruptPending=true;
 assert(forja65_try_wram_stores_rtl(cpu,hw,0x7F8000,true));
 assert(hw.dispatchPending&&hw.nmiServiceCount==1);assert(hw.ram[0x201]==0);
 auto resumed=cpu.returnInterrupt(hw);assert(resumed==0x7F8000);hw.dispatchPending=false;
 assert(forja65_try_wram_stores_rtl(cpu,hw,resumed,false));
 for(unsigned i=0;i<128;i++)assert(hw.ram[0x201+i*4]==0xF0);
 assert(cpu.a==0xABF0&&cpu.s==0x1FF&&cpu.pb==0&&hw.nativeReturns.empty());
 assert(hw.cpuInstructionCount==130);
 SnesRuntime mid;CpuState middle;prepare(middle,mid);mid.beginFrame();mid.currentScanline=mid.visibleLines()-1;mid.currentMasterCycle=mid.MASTER_CYCLES_PER_SCANLINE-100;
 assert(forja65_try_wram_stores_rtl(middle,mid,0x7F8000,true));assert(mid.dispatchPending&&mid.nmiServiceCount==1);
 auto next=middle.returnInterrupt(mid);assert(next>0x7F8002&&next<0x7F8182);mid.dispatchPending=false;
 assert(mid.ram[0x201]==0xF0&&mid.ram[0x3FD]==0);assert(forja65_try_wram_stores_rtl(middle,mid,next,false));
 assert(mid.ram[0x3FD]==0xF0&&middle.s==0x1FF&&mid.wramStoreContinuations.empty());
 SnesRuntime irq;CpuState interrupted;prepare(interrupted,irq);interrupted.i=false;irq.cpuIrqInterruptPending=true;irq.io.hIrqEnable=true;
 assert(forja65_try_wram_stores_rtl(interrupted,irq,0x7F8000,true));assert(irq.irqServiceCount==1&&irq.dispatchPending);
 irq.cpuIrqInterruptPending=false;irq.io.irqPending=false;irq.io.hIrqEnable=false;auto irqPc=interrupted.returnInterrupt(irq);irq.dispatchPending=false;
 assert(forja65_try_wram_stores_rtl(interrupted,irq,irqPc,false));assert(interrupted.s==0x1FF&&irq.ram[0x3FD]==0xF0);
 SnesRuntime invalid;CpuState other;prepare(other,invalid);invalid.ram[0x18004]=0x21;
 assert(!forja65_try_wram_stores_rtl(other,invalid,0x7F8000,true));assert(invalid.ram[0x201]==0);
 SnesRuntime changed;CpuState third;prepare(third,changed);changed.cpuNmiInterruptPending=true;
 assert(forja65_try_wram_stores_rtl(third,changed,0x7F8000,true));auto pc=third.returnInterrupt(changed);changed.dispatchPending=false;changed.ram[0x18001]=0x55;
 assert(!forja65_try_wram_stores_rtl(third,changed,pc,false));assert(changed.ram[0x201]==0);
}
`);
cp.execFileSync('g++',['-std=c++20','-O0',path.join(dir,'test.cpp'),'-o',path.join(dir,'test')]);
cp.execFileSync(path.join(dir,'test'),[],{stdio:'inherit'});console.log('WRAM_STORES_INTERRUPT_RESUME_PASS');
