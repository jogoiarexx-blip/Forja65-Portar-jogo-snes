'use strict';
const F=require('../forja65-core'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,64));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'control-checkpoint144-'));
try{
 for(const[n,v]of Object.entries(files))if(n.startsWith('src/')&&n.endsWith('.hpp'))fs.writeFileSync(path.join(dir,path.basename(n)),v);
 fs.writeFileSync(path.join(dir,'probe.cpp'),String.raw`#include "forja_checkpoint.hpp"
#include <memory>
#include <cassert>
#include <iostream>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
int main(){CpuState cpu;auto h=std::make_unique<SnesRuntime>();h->controlMode=true;h->inputReplay.resize(3);h->inputReplayPos=2;h->ram[1234]=91;
 h->controlFrame();assert(h->inputReplay.empty());assert(h->inputReplayPos==0);
 h->stopped=false;auto saved=forja_checkpoint::save("control.f65s",cpu,*h);
 auto restored=std::make_unique<SnesRuntime>();restored->controlMode=false;
 forja_checkpoint::load("control.f65s",cpu,*restored);
 assert(restored->inputReplayPos==0);assert(restored->ram[1234]==91);assert(restored->frameCounter==saved.frame);
 std::cout<<"CONTROL_REPLAY_CHECKPOINT_REV144_PASS strict-load-after-control-detach\n";}
`);
 cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','probe.cpp','-o','probe'],{cwd:dir,stdio:'inherit'});
 const r=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,input:'finish\n',encoding:'utf8',timeout:10000,env:{...process.env,FORJA65_CONTROL_DIR:path.join(dir,'control')}});
 assert.equal(r.status,0,r.stderr);assert(r.stdout.includes('CONTROL_REPLAY_CHECKPOINT_REV144_PASS'));console.log('CONTROL_REPLAY_CHECKPOINT_REV144_PASS native strict-loader roundtrip');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
