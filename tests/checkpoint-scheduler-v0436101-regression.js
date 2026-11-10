'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),C=require('../forja65-core');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-checkpoint-state-'));
try{
 const rom=C.loadRom(C.makeSyntheticRom()),files=C.generateProject(rom,C.analyze(rom,64));
 for(const[n,v]of Object.entries(files))if(n.startsWith('src/')){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
 fs.writeFileSync(path.join(dir,'probe.cpp'),`#include "forja_checkpoint.hpp"
#include <iostream>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
int main(){CpuState c;SnesRuntime a,b;a.headless=b.headless=true;
 a.frameTimingActive=true;a.currentScanline=10;a.currentMasterCycle=54;a.cpuMasterClock=10000;
 a.hdmaSetupComplete=true;a.hdmaSetupPosition=17;a.irqComparatorValid=true;a.irqComparatorPollPending=true;a.nmiStatusHoldUntil=10004;a.irqStatusHoldUntil=10004;a.io.nmiPending=true;a.io.irqPending=true;a.cpuIrqInterruptPending=true;
 a.objEvalCursor=19;a.objEvalInRange=7;a.objEvalSelectedCount=2;a.objEvalSelected[0]=9;a.objEvalSelected[1]=4;a.objEvalRotationBase=5;a.objTimeEvaluated=true;
 a.objFetchedSliverCount=1;a.objFetchedSlivers[0].chrPlanes[0]=0x55;a.objDisplaySliverCount=1;a.objDisplaySliverLine=11;a.objDisplaySlivers[0].chrPlanes[3]=0x77;a.objDisplayInterlace=true;a.objDisplayField=true;
 a.objFetchSlots=3;a.objFetchSlivers=4;a.objFetchSpritePos=2;a.objFetchTileOffset=8;a.objFetchSpriteWidth=32;a.objFetchSpriteHeight=64;a.objFetchSpriteIndex=9;a.objFetchSpriteTile=33;a.objFetchSpriteY=17;a.objFetchSpriteX=-4;a.objFetchSpriteAttributes=0xc0;a.objFetchSpriteObsel=3;a.objFetchSpriteLoaded=true;a.objFetchSpriteAttributesLoaded=true;
 a.apu.spc.test=2;a.apu.spc.aux[0]=0x39;a.apu.timedEchoEnabled=true;a.apu.timedEchoCurrentProtection=true;a.apu.timedEchoProtection.push_back({10008,false});
 auto payload=forja_checkpoint::encode(c,a);forja_checkpoint::decode(payload,c,b);
 if(!b.hdmaSetupComplete||b.hdmaSetupPosition!=17||!b.irqComparatorValid||!b.irqComparatorPollPending||b.nmiStatusHoldUntil!=10004||b.irqStatusHoldUntil!=10004){std::cerr<<"CHECKPOINT_SCHEDULER_LATCHES_LOST\\n";return 2;}
 if(b.objEvalCursor!=19||b.objEvalSelectedCount!=2||b.objEvalSelected[0]!=9||b.objFetchedSlivers[0].chrPlanes[0]!=0x55||b.objDisplaySlivers[0].chrPlanes[3]!=0x77||b.objDisplaySliverLine!=11||!b.objDisplayInterlace||!b.objDisplayField||b.objFetchSpriteX!=-4||b.objFetchSpriteWidth!=32||!b.objFetchSpriteLoaded||!b.objFetchSpriteAttributesLoaded){std::cerr<<"CHECKPOINT_OBJ_STAGING_LOST\\n";return 3;}
 if(b.apu.spc.test!=2||b.apu.spc.aux[0]!=0x39||!b.apu.timedEchoEnabled||b.apu.timedEchoProtection.size()!=1||b.apu.timedEchoProtection[0].master!=10008){std::cerr<<"CHECKPOINT_APU_EVENTS_LOST\\n";return 4;}
 // Same live status hold behavior before and after the four-clock deadline.
 if(a.read(0x4211)!=b.read(0x4211)||!b.io.irqPending)return 5;
 a.cpuMasterClock=b.cpuMasterClock=10004;
 if(a.read(0x4211)!=b.read(0x4211)||b.io.irqPending)return 6;
 if(forja_checkpoint::encode(c,a)!=forja_checkpoint::encode(c,b))return 7;
 auto h=forja_checkpoint::makeHeader(a,payload);h.version=1;
 bool rejected=false;try{forja_checkpoint::validate(h,a);}catch(...){rejected=true;}
 if(!rejected){std::cerr<<"LEGACY_INCOMPLETE_CHECKPOINT_ACCEPTED\\n";return 8;}
 // Exercise real file validation and atomic load, not just in-memory codec.
 forja_checkpoint::save("state.f65s",c,a);b.hdmaSetupComplete=false;
 forja_checkpoint::load("state.f65s",c,b);
 if(!b.hdmaSetupComplete||b.objDisplaySlivers[0].chrPlanes[3]!=0x77)return 9;
 auto before=forja_checkpoint::encode(c,b);
 {std::fstream bad("state.f65s",std::ios::in|std::ios::out|std::ios::binary);bad.seekg(-1,std::ios::end);char q;bad.read(&q,1);q^=1;bad.seekp(-1,std::ios::end);bad.write(&q,1);}
 rejected=false;try{forja_checkpoint::load("state.f65s",c,b);}catch(...){rejected=true;}
 if(!rejected||forja_checkpoint::encode(c,b)!=before)return 10;
 std::cout<<"CHECKPOINT_SCHEDULER_OBJ_APU_ROUNDTRIP_PASS\\n";
}
`);
 const p=cp.spawnSync('g++',['-std=c++20','-O0','-DFORJA65_ENABLE_TRACE=0','-Isrc','probe.cpp','-o','probe'],{cwd:dir,encoding:'utf8',timeout:120000});assert.equal(p.status,0,p.stderr);
 const q=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,encoding:'utf8',timeout:20000});assert.equal(q.status,0,q.stdout+q.stderr);process.stdout.write(q.stdout);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
