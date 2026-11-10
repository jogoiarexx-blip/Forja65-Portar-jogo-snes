'use strict';
// Backend plumbing and serialization only: this does not certify DSP opcode
// accuracy, synthesized firmware fidelity, or any game's progress.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const C=require(process.env.FORJA_TEST_CORE||'../forja65-core');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-cx4-native-state-'));
try{
 const bytes=C.makeSyntheticRom();bytes[0x7fbf]=0x10;bytes[0x7fd6]=0xf3;
 const rom=C.loadRom(bytes),files=C.generateProject(rom,C.analyze(rom,64));
 for(const[n,v]of Object.entries(files))if(n.startsWith('src/')){
  const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);
 }
 fs.writeFileSync(path.join(dir,'synthetic-cart.bin'),bytes);
 fs.writeFileSync(path.join(dir,'probe.cpp'),String.raw`#include "forja_checkpoint.hpp"
#include <iostream>
#include <memory>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
static void require(bool ok,const char*message){if(!ok)throw std::runtime_error(message);}
static std::unique_ptr<SnesRuntime> runtime(std::size_t sramSize){
 auto hw=std::make_unique<SnesRuntime>();hw->headless=true;
 std::ifstream input("synthetic-cart.bin",std::ios::binary);
 hw->cart.assign(std::istreambuf_iterator<char>(input),{});
 require(!hw->cart.empty(),"synthetic cart missing");
 hw->sram.assign(sramSize,0x42);hw->cartChip=CartChip::CX4;hw->initCx4();
 require(bool(hw->cx4Device)&&cx4_firmware_loaded(hw->cx4Device.get()),"real Cx4 initialization failed");
 return hw;
}
int main(){try{
 auto hw=runtime(32);CpuState cpu;cpu.a=0x7319;
 hw->write8(0x006000,0x5a);hw->write8(0x806001,0xa5);
 require(hw->read(0x006000)==0x5a&&hw->read(0x806001)==0xa5,"Cx4 mapped RAM write/read failed");
 hw->frameCounter=7;hw->cpuMasterClock=120;hw->syncCx4();
 const auto* const sramPointer=hw->sram.data();
 const auto header=forja_checkpoint::save("valid.f65s",cpu,*hw);
 require(header.version==3,"Cx4 must save checkpoint V3");
 const auto saved=forja_checkpoint::encode(cpu,*hw);
 hw->write8(0x006000,0x11);hw->write8(0x806001,0x22);cpu.a=0;hw->sram[0]=0x99;
 forja_checkpoint::load("valid.f65s",cpu,*hw);
 require(hw->sram.data()==sramPointer,"valid restore moved Cx4-owned SRAM storage");
 require(forja_checkpoint::encode(cpu,*hw)==saved,"V3 full backend state roundtrip mismatch");
 require(cpu.a==0x7319&&hw->sram[0]==0x42,"CPU/SRAM state lost");
 require(cx4_read(hw->cx4Device.get(),0x6000)==0x5a&&cx4_read(hw->cx4Device.get(),0x6001)==0xa5,"Cx4 device RAM not restored");
 std::cout<<"CX4_NATIVE_V3_ROUNDTRIP_PASS device_ram=5a,a5 sram_pointer_stable=1\n";
 auto malformed=runtime(33);CpuState wrong;
 auto payload=forja_checkpoint::encode(wrong,*malformed);
 auto badHeader=forja_checkpoint::makeHeader(*malformed,payload);
 {std::ofstream out("wrong-sram.f65s",std::ios::binary);out.write(reinterpret_cast<const char*>(&badHeader),sizeof(badHeader));out.write(reinterpret_cast<const char*>(payload.data()),payload.size());require(bool(out),"malformed fixture write failed");}
 const auto before=forja_checkpoint::encode(cpu,*hw);bool rejected=false;
 try{forja_checkpoint::load("wrong-sram.f65s",cpu,*hw);}catch(const std::exception&){rejected=true;}
 require(rejected,"wrong SRAM size accepted with real Cx4 backend");
 require(hw->sram.data()==sramPointer&&forja_checkpoint::encode(cpu,*hw)==before,"rejected load mutated live CPU/runtime/device state");
 require(hw->read(0x806000)==0x5a,"Cx4 read failed after rejected load");
 hw->write8(0x006002,0xc7);require(hw->read(0x806002)==0xc7,"Cx4 write/read failed after rejected load");
 hw->sram[1]=0x93;require(hw->sram.data()==sramPointer,"SRAM ownership changed after rejected load");
 std::cout<<"CX4_NATIVE_ATOMIC_REJECTION_PASS continued_bus_read_write=1\n";
 std::cout<<"CX4_NATIVE_CHECKPOINT_REV174_PASS scope=backend_plumbing_serialization\n";
 return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 2;}}
`);
 function compile(command,args){const p=cp.spawnSync(command,args,{cwd:dir,encoding:'utf8',timeout:120000});assert.equal(p.status,0,p.stdout+p.stderr+(p.error?.message||''));}
 compile(process.env.CC||'gcc',['-std=c99','-O0','-Isrc/cx4_vendor','-c','src/cx4_vendor/cx4.c','-o','cx4.o']);
 const flags=['-std=c++20','-O0','-DFORJA65_ENABLE_TRACE=0','-DFORJA65_CX4_LLE=1','-Isrc','-Isrc/cx4_vendor','probe.cpp','cx4.o','-lm','-o','probe'];
 if(process.platform==='win32')flags.push('-luser32','-lgdi32','-lxinput9_1_0','-lwinmm');
 compile(process.env.CXX||'g++',flags);
 const env={...process.env};delete env.SNESRECOMP_CX4_ROM;
 const run=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,env,encoding:'utf8',timeout:20000});
 process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');
 assert.equal(run.status,0,'real C99 Cx4 backend must survive V3 checkpoint and rejected malformed load');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
