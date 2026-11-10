'use strict';
// Native return targets must work with the CPU interpreter object omitted.
const F=require('../forja65-core'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const d=F.makeSyntheticRom();d.fill(0xea,0,0x7fc0);d.set([0x18,0xfb,0xc2,0x30,0x20,0,0x90,0x22,0,0xa0,0,0xa9,0xef,0xbe,0x85,0x10,0xdb],0);d[0x1000]=0x60;d[0x2000]=0x6b;
const rom=F.loadRom(d),files=F.generateProject(rom,F.analyze(rom,256));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'backend145-'));
for(const[n,v]of Object.entries(files)){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
fs.writeFileSync(path.join(dir,'src/main.cpp'),String.raw`#include "generated.hpp"
#include <memory>
#include <cassert>
#include <iostream>
int main(){auto h=std::make_unique<SnesRuntime>();h->loadCart("assets/cart-data.bin");assert(!forja65_interpreter_enabled());assert(forja65_is_stack_return_target(0x8007,*h));assert(forja65_is_stack_return_target(0x808007,*h));assert(forja65_is_stack_return_target(0x800B,*h));assert(!forja65_is_stack_return_target(0x8000,*h));assert(!forja65_is_stack_return_target(0x8345,*h));assert(!forja65_is_stack_return_target(0x7e0000,*h));std::cout<<"NATIVE_STACK_TARGETS_REV145_PASS no CPU interpreter object"<<std::endl;}
`);
const src=path.join(dir,'src'),flags=['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-I'+src];cp.execFileSync('g++',[...flags,'-x','c++-header',path.join(src,'runtime.hpp'),'-o',path.join(src,'runtime.hpp.gch')]);
const objs=[];for(const f of fs.readdirSync(src).filter(n=>n.endsWith('.cpp')&&n!=='forja_cpu_interpreter.cpp')){const o=path.join(dir,f+'.o');cp.execFileSync('g++',[...flags,'-include',path.join(src,'runtime.hpp'),'-c',path.join(src,f),'-o',o]);objs.push(o);}
const exe=path.join(dir,'probe');cp.execFileSync('g++',[...objs,'-o',exe]);
const env={...process.env,FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:'0'};delete env.FORJA65_CPU_BACKEND;
cp.execFileSync(exe,[],{cwd:dir,stdio:'inherit',timeout:10000,env});
