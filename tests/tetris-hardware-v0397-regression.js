'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'hw0397.sfc');
const out=F.generateProject(rom,F.analyze(rom,1024));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-v0397-hw-'));
fs.writeFileSync(path.join(dir,'runtime.hpp'),out['src/runtime.hpp']);
fs.writeFileSync(path.join(dir,'hw.cpp'),String.raw`#include "runtime.hpp"
#include <cassert>
#include <vector>
int main(){
 CpuState c;c.decimalMode=true;c.m8=true;c.a=0x99;c.c=false;c.adc(1);assert(c.a==0&&c.c);c.a=0;c.c=true;c.sbc(1);assert(c.a==0x99&&!c.c);
 // Ares, bsnes and Mesen2 refill the latch before incrementing VMADD.
 // The first word is therefore returned twice; tested by hardware-differential-v043618.
 PpuState p;p.vram[0]=0x12;p.vram[2]=0x34;p.write(0x2115,0);p.write(0x2116,0);p.write(0x2117,0);assert(p.read(0x2139)==0x12);assert(p.read(0x2139)==0x12);assert(p.read(0x2139)==0x34);
 ApuBridge a;assert(a.spcRead(0xFD)==0);a.spc.timerOut[0]=5;assert(a.spcRead(0xFD)==5);assert(a.spcRead(0xFD)==0);a.spc.timerStage[0]=8;a.spcWrite(0xF1,1);assert(a.spc.timerStage[0]==0);
 NativeRomStore r;r.regions={{20,{1,2,3}},{50,{4}}};std::uint8_t q=0;assert(r.read(21,q)&&q==2);assert(!r.read(23,q));assert(r.read(50,q)&&q==4);
 SpcDsp dsp;std::vector<std::uint8_t> ram(65536);auto x=dsp.renderSample(ram);assert(x[0]==0&&x[1]==0);return 0;
}`);
const cc=process.env.CXX||'g++';cp.execFileSync(cc,['-std=c++20','-O0',path.join(dir,'hw.cpp'),'-o',path.join(dir,'hw')],{stdio:'inherit'});
cp.execFileSync(path.join(dir,'hw'),[],{cwd:dir,stdio:'inherit'});
console.log('Tetris hardware v0.3.97: PASS');
