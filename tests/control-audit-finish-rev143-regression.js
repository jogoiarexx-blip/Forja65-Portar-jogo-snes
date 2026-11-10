'use strict';
const F=require('../forja65-core'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,64)),dir=fs.mkdtempSync(path.join(os.tmpdir(),'control143-'));
for(const[n,v]of Object.entries(files))if(n.startsWith('src/')&&n.endsWith('.hpp'))fs.writeFileSync(path.join(dir,path.basename(n)),v);
fs.writeFileSync(path.join(dir,'probe.cpp'),String.raw`#include "runtime.hpp"
#include <memory>
#include <cassert>
#include <iostream>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
int main(int argc,char**){auto h=std::make_unique<SnesRuntime>();h->headless=true;h->controlMode=true;h->controlAtVblank=argc>1;h->advanceCpuMasterCycles(1364u*262u*3u);assert(h->stopped);if(h->controlAtVblank){assert(!h->io.vblank);assert(h->currentScanline==h->visibleLines());}else{assert(h->frameCounter==1);assert(!h->frameTimingActive);}std::cout<<"AFTER_GRACEFUL_FINISH\n";}
`);
cp.execFileSync('g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','probe.cpp','-o','probe'],{cwd:dir,stdio:'inherit'});fs.mkdirSync(path.join(dir,'blocked/native-dependency.txt'),{recursive:true});
for(const args of [[],['vblank']]){
const r=cp.spawnSync(path.join(dir,'probe'),args,{cwd:dir,input:'save sample\naudit audit\naudit blocked\nfinish\n',encoding:'utf8',timeout:10000,env:{...process.env,FORJA65_CONTROL_DIR:path.join(dir,'control')}});
assert.equal(r.status,0,r.stderr);assert(r.stdout.includes('AFTER_GRACEFUL_FINISH'));assert(r.stdout.includes('err audit'));assert.equal(fs.statSync(path.join(dir,'audit/spc-ram.bin')).size,65536);assert(fs.readFileSync(path.join(dir,'audit/native-dependency.txt'),'utf8').includes('CPU_FULLY_NATIVE=NO'));assert.equal(fs.readdirSync(path.join(dir,'control')).length,0);
}
console.log('CONTROL_AUDIT_FINISH_REV143_PASS scheduler-stop snapshot-cleanup write-failure');
