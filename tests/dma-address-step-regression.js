'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('assert'),C=require('../forja65-core');
const rom=C.loadRom(C.makeSyntheticRom()),files=C.generateProject(rom,C.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dma-step-'));
for(const [n,v]of Object.entries(files)){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
fs.writeFileSync(path.join(dir,'probe.cpp'),String.raw`#include "src/runtime.hpp"
#include <cassert>
int main(){for(bool native:{false,true}){
 // Fixed source overrides decrement; DMA fills the B-bus WRAM port from ROM.
 for(unsigned mode:{0x08u,0x18u}){SnesRuntime h;h.cart.assign(0x10000,0x6b);h.cart[0x100]=0;h.nativeDmaEnabled=native;h.io.wramPortAddr=0x2400;h.dma[7].dmap=mode;h.dma[7].bbad=0x80;h.dma[7].a1b=0x80;h.dma[7].a1t=0x8100;h.dma[7].das=32;h.executeDma(0x80);for(unsigned i=0x2400;i<0x2420;i++)assert(h.ram[i]==0);assert(h.dma[7].a1t==0x8100&&h.dma[7].a1b==0x80&&h.dma[7].das==0&&h.io.wramPortAddr==0x2420);}
 // Increment/decrement wrap the 16-bit A-bus offset; bank never changes.
 for(bool dec:{false,true}){SnesRuntime h;h.nativeDmaEnabled=native;auto&d=h.dma[0];d.dmap=dec?0x10:0;d.bbad=0x22;d.a1b=0x7e;d.a1t=dec?0:0xffff;d.das=2;h.ram[0]=0x11;h.ram[0xffff]=0x22;h.ram[0x10000]=0x77;h.ppu.cgAddr=0;h.executeDma(1);assert(h.ppu.cgram[0]==(dec?0x11:0x22)&&h.ppu.cgram[1]==(dec?0x22:0x11));assert(d.a1b==0x7e&&d.a1t==(dec?0xfffe:1)&&d.das==0);}
 // Reverse DMA uses the same stepping on its A-bus destination.
 {SnesRuntime h;h.nativeDmaEnabled=native;h.ppu.cgram[0]=0x12;h.ppu.cgram[1]=0x34;auto&d=h.dma[0];d.dmap=0x90;d.bbad=0x3b;d.a1b=0x7e;d.a1t=0;d.das=2;h.executeDma(1);assert(h.ram[0]==0x12&&h.ram[0xffff]==0x34&&d.a1b==0x7e&&d.a1t==0xfffe);}
 } }
`);
cp.execFileSync('g++',['-std=c++20','-O2','probe.cpp','-o','probe'],{cwd:dir});cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir});
assert(files['src/runtime.hpp'].includes('void executeDma'));
console.log('dma-address-step-regression: OK (fixed fill, decrement, 16-bit wrap, reverse, both DMA paths)');
