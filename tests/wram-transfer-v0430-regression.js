'use strict';
const C=require('../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const bytes=C.makeSyntheticRom();bytes[0]=0xDB;
const rom=C.loadRom(bytes),files=C.generateProject(rom,C.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-transfer-v0430-'));
try{
 for(const [name,value] of Object.entries(files)){const dest=path.join(dir,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,value);}
 fs.writeFileSync(path.join(dir,'probe.cpp'),String.raw`#include "generated.hpp"
#include <cassert>
#include <iostream>
int main(){
 for(unsigned op:{0x5Cu,0x4Cu,0x6Cu,0xDCu,0x7Cu}){
  SnesRuntime h;CpuState c;h.headless=true;h.cart.assign(0x8000,0);h.cart[0]=0xDB;c.a=0x1234;c.x=2;c.db=0x66;h.ram[0x18000]=op;
  // Secondary WRAM trampoline is a JML to the compiled ROM STP.
  h.ram[0x19000]=0x5C;h.ram[0x19001]=0;h.ram[0x19002]=0x80;h.ram[0x19003]=0;
  if(op==0x5C){h.ram[0x18001]=0;h.ram[0x18002]=0x80;h.ram[0x18003]=0;}
  if(op==0x4C){h.ram[0x18001]=0;h.ram[0x18002]=0x90;}
  if(op==0x6C||op==0xDC){h.ram[0x18001]=0x00;h.ram[0x18002]=0x04;h.ram[0x400]=0;h.ram[0x401]=(op==0x6C?0x90:0x80);h.ram[0x402]=0;}
  if(op==0x7C){h.ram[0x18001]=0;h.ram[0x18002]=0xA0;h.ram[0x1A002]=0;h.ram[0x1A003]=0x90;}
  forja65_dispatch(c,h,0x7F8000,0x008100);assert(h.stopped);assert(c.a==0x1234&&c.x==2&&c.db==0x66&&c.s==0x1FF&&h.nativeReturns.empty());assert(h.cpuInstructionCount==(op==0x4C||op==0x6C||op==0x7C?3u:2u));
 }
 // A tail jump must preserve the tracked JSL return used by a WRAM fill.
 {SnesRuntime h;CpuState c;h.headless=true;c.e=false;c.m8=true;c.db=0;c.s=0x1FF;c.a=0xAB01;c.push8Value(h,0);c.push16Value(h,0x8080);h.pushNativeReturn(0x8081,true,c);h.nativeCallPending=true;
  std::uint8_t jump[]={0x4C,0x00,0x90},fill[]={0xA9,0x55,0x8D,0x00,0x04,0x6B};std::copy(std::begin(jump),std::end(jump),h.ram.begin()+0x18000);std::copy(std::begin(fill),std::end(fill),h.ram.begin()+0x19000);forja65_dispatch(c,h,0x7F8000,0x008100);assert(h.ram[0x400]==0x55&&c.a==0xAB55&&c.s==0x1FF&&h.nativeReturns.empty());}
 // ROM mapping alone must not approve an overlaid cartridge chip.
 {SnesRuntime h;CpuState c;h.headless=true;h.cart.assign(0x8000,0);h.cartChip=CartChip::DSP1;h.ram[0x1000]=0x7C;h.ram[0x1001]=0;h.ram[0x1002]=0x80;bool rejected=false;try{forja65_dispatch(c,h,0x201000,0x008100);}catch(const std::exception&){rejected=true;}assert(rejected&&h.hwUsage.cartChipReads==0&&h.cpuInstructionCount==0);}
 // Low WRAM mirrors use the requested program bank, not the physical WRAM bank.
 {SnesRuntime h;CpuState c;h.headless=true;h.cart.assign(0x8000,0);h.ram[0x1000]=0x4C;h.ram[0x1001]=0;h.ram[0x1002]=0x80;forja65_dispatch(c,h,0x001000,0x008100);assert(h.stopped&&c.pb==0);}
 // Indirect indexed pointer wraps inside the program bank at $FFFF.
 {SnesRuntime h;CpuState c;h.headless=true;h.cart.assign(0x8000,0);h.ram[0x18000]=0x7C;h.ram[0x18001]=0xFE;h.ram[0x18002]=0xFF;c.x=1;h.ram[0x1FFFF]=0;h.ram[0x10000]=0x90;h.ram[0x19000]=0x5C;h.ram[0x19001]=0;h.ram[0x19002]=0x80;h.ram[0x19003]=0;forja65_dispatch(c,h,0x7F8000,0x008100);assert(h.stopped);}
 for(unsigned bad:{0u,1u,2u}){SnesRuntime h;CpuState c;h.headless=true;h.cart.assign(0x8000,0);h.ram[0x18000]=0xDC;h.ram[0x18001]=0;h.ram[0x18002]=bad==0?0x21:0x04;h.ram[0x400]=0;h.ram[0x401]=bad==1?0x21:(bad==2?0x60:0x80);h.ram[0x402]=0;auto clock=h.cpuMasterClock;bool rejected=false;try{forja65_dispatch(c,h,0x7F8000,0x008100);}catch(const std::exception&){rejected=true;}assert(rejected&&h.cpuMasterClock==clock&&h.cpuInstructionCount==0);}
 std::cout<<"WRAM_TRANSFER_V0430_PASS JML/JMP/indirect/long/indexed chained=1 mirror=1 pointer_wrap=1 invalid=3\n";
}
`);
 const sources=['probe.cpp','src/dispatch.cpp',...Object.keys(files).filter(n=>/^src\/generated_.*\.cpp$/.test(n))];
 cp.execFileSync('g++',['-std=c++20','-O0','-Wall','-Wextra','-Wpedantic','-Werror','-Isrc',...sources,'-o','probe'],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,stdio:'inherit'});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
