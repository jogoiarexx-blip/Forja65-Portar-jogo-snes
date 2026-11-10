'use strict';
// Public file loading must reject structurally invalid, correctly checksummed
// checkpoints before any live state changes (especially Cx4-owned SRAM pointers).
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const C=require(process.env.FORJA_TEST_CORE||'../forja65-core');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-checkpoint-shape-'));
try{
 const rom=C.loadRom(C.makeSyntheticRom()),files=C.generateProject(rom,C.analyze(rom,64));
 for(const[n,v]of Object.entries(files))if(n.startsWith('src/')){
  const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);
 }
 fs.writeFileSync(path.join(dir,'probe.cpp'),String.raw`#include "forja_checkpoint.hpp"
#include <iostream>
#include <memory>
#include <functional>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
static void require(bool condition,const char*message){if(!condition)throw std::runtime_error(message);}
static void writePayload(const std::string&path,CpuState&cpu,SnesRuntime&hw){
 auto payload=forja_checkpoint::encode(cpu,hw);
 auto header=forja_checkpoint::makeHeader(hw,payload);
 std::ofstream out(path,std::ios::binary|std::ios::trunc);
 out.write(reinterpret_cast<const char*>(&header),sizeof(header));
 out.write(reinterpret_cast<const char*>(payload.data()),payload.size());
 require(bool(out),"fixture write failed");
}
int main(){try{
 auto source=std::make_unique<SnesRuntime>();source->headless=true;
 source->sram.assign(32,0x5a);source->ram[17]=0x71;source->ppu.vram[19]=0x82;
 source->frameCounter=9;CpuState saved;saved.a=0x1234;
 forja_checkpoint::save("valid.f65s",saved,*source);
 auto live=std::make_unique<SnesRuntime>();live->headless=true;live->sram.assign(32,0);
 CpuState cpu;forja_checkpoint::load("valid.f65s",cpu,*live);
 require(cpu.a==0x1234&&live->frameCounter==9&&live->sram.size()==32&&live->sram[0]==0x5a&&live->ram[17]==0x71&&live->ppu.vram[19]==0x82,"valid checkpoint did not restore state");
 std::cout<<"VALID_CHECKPOINT_LOAD_PASS\n";
 unsigned failures=0;
 // Empty, smaller and larger SRAM shapes must all be rejected, even though
 // their payloads, checksums, ROM fingerprint and execution profiles are valid.
 for(const std::size_t length:{0u,31u,33u,64u}){
  forja_checkpoint::load("valid.f65s",cpu,*live);
  source->sram.assign(length,0xe3);writePayload("wrong-sram.f65s",saved,*source);
  const auto before=forja_checkpoint::encode(cpu,*live);
  const auto* const sramPointer=live->sram.data();bool rejected=false;
  try{forja_checkpoint::load("wrong-sram.f65s",cpu,*live);}catch(const std::exception&){rejected=true;}
  const bool unchanged=forja_checkpoint::encode(cpu,*live)==before&&live->sram.data()==sramPointer;
  if(!rejected||!unchanged){++failures;std::cerr<<"CHECKPOINT_SRAM_SHAPE_FAIL length="<<length<<" rejected="<<rejected<<" unchanged="<<unchanged<<'\n';}
  // Reset explicitly after a bad implementation accepts a malformed payload,
  // so every case starts from the same legitimate cartridge allocation.
  live=std::make_unique<SnesRuntime>();live->headless=true;live->sram.assign(32,0);
 }
 const std::pair<const char*,std::function<void(SnesRuntime&)>> fixedShapes[]={
  {"ram",[](SnesRuntime&hw){hw.ram.resize(0x1ffff);}},
  {"ppu.vram",[](SnesRuntime&hw){hw.ppu.vram.resize(0xffff);}},
  {"ppu.cgram",[](SnesRuntime&hw){hw.ppu.cgram.resize(511);}},
  {"ppu.oam",[](SnesRuntime&hw){hw.ppu.oam.resize(543);}},
  {"apu.spc.ram",[](SnesRuntime&hw){hw.apu.spc.ram.resize(65535);}},
 };
 for(const auto&[name,changeShape]:fixedShapes){
  forja_checkpoint::load("valid.f65s",cpu,*live);
  source=std::make_unique<SnesRuntime>();source->headless=true;source->sram.assign(32,0);
  forja_checkpoint::load("valid.f65s",saved,*source);
  changeShape(*source);writePayload("wrong-fixed.f65s",saved,*source);
  const auto before=forja_checkpoint::encode(cpu,*live);
  const auto* const sramPointer=live->sram.data();bool rejected=false;
  try{forja_checkpoint::load("wrong-fixed.f65s",cpu,*live);}catch(const std::exception&){rejected=true;}
  const bool unchanged=forja_checkpoint::encode(cpu,*live)==before&&live->sram.data()==sramPointer;
  if(!rejected||!unchanged){++failures;std::cerr<<"CHECKPOINT_FIXED_SHAPE_FAIL field="<<name<<" rejected="<<rejected<<" unchanged="<<unchanged<<'\n';}
  live=std::make_unique<SnesRuntime>();live->headless=true;live->sram.assign(32,0);
 }
 if(failures)return 1;
 std::cout<<"CHECKPOINT_SHAPE_REV174_PASS atomic SRAM and fixed-vector shape rejection\n";
 return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 2;}}
`);
 const flags=['-std=c++20','-O0','-DFORJA65_ENABLE_TRACE=0','-Isrc','probe.cpp','-o','probe'];
 if(process.platform==='win32')flags.push('-luser32','-lgdi32','-lxinput9_1_0','-lwinmm');
 const build=cp.spawnSync(process.env.CXX||'g++',flags,{cwd:dir,encoding:'utf8',timeout:120000});
 assert.equal(build.status,0,build.stderr||build.error?.message);
 const run=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,encoding:'utf8',timeout:20000});
 process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');
 assert.equal(run.status,0,'public load must reject rechecksummed wrong SRAM and fixed-vector sizes atomically');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
