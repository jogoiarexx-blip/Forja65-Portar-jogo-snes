"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'obj-slot-evidence.sfc');
const project=C.generateProject(rom,C.analyze(rom,256,[]));
const rt=project['src/runtime.hpp'];
assert(rt.includes('FORJA65_OBJ_SLOTS_PATH'));
assert(rt.includes('slotPixels[q.oamIndex]++'));
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-obj-slots-v0385-'));
const cpp=String.raw`#include "runtime.hpp"
#include <fstream>
#include <iostream>
#include <sstream>
#include <cstdlib>
#include <filesystem>
int main(){
 const char*mainPath="probe.csv",*slotsPath="slots.csv";
#ifdef _WIN32
 _putenv_s("FORJA65_OBJ_PROBE_PATH",mainPath);
 _putenv_s("FORJA65_OBJ_SLOTS_PATH",slotsPath);
 _putenv_s("FORJA65_OBJ_PROBE_START","7");
 _putenv_s("FORJA65_OBJ_PROBE_INTERVAL","1");
#else
 setenv("FORJA65_OBJ_PROBE_PATH",mainPath,1);
 setenv("FORJA65_OBJ_SLOTS_PATH",slotsPath,1);
 setenv("FORJA65_OBJ_PROBE_START","7",1);
 setenv("FORJA65_OBJ_PROBE_INTERVAL","1",1);
#endif
 SnesRuntime hw;hw.ppu.tm=0x10;hw.ppu.obsel=0;
 hw.ppu.oam.assign(544,0);
 for(unsigned i=1;i<128u;i++)hw.ppu.oam[512u+i/4u]|=(std::uint8_t)(1u<<((i%4u)*2u));
 hw.ppu.oam[0]=16;hw.ppu.oam[1]=20;
 hw.ppu.vram.assign(65536,0);hw.ppu.vram[0]=0x80;
 hw.frameCounter=7;hw.appendObjInputProbe();
 hw.ppu.oam[0]=32;hw.frameCounter=8;hw.appendObjInputProbe();
 std::ifstream in(slotsPath);std::string line;std::vector<std::string> rows;
 while(std::getline(in,line))rows.push_back(line);
 if(rows.size()!=3u||rows[0]!="frame,slot,x,y,width,height,tile,attributes,visible_pixels,min_x,min_y,max_x,max_y"
   ||rows[1]!="7,0,16,20,8,8,0,0,1,16,20,16,20"
   ||rows[2]!="8,0,32,20,8,8,0,0,1,32,20,32,20"){
   std::cerr<<"OBJ_SLOT_EVIDENCE_FAIL rows="<<rows.size()<<"\n";
   for(const auto&s:rows)std::cerr<<s<<"\n";
   return 1;
 }
 std::filesystem::remove(mainPath);std::filesystem::remove(slotsPath);
 std::cout<<"OBJ_SLOT_EVIDENCE_PASS two_frames=2 opaque_slots=1\n";
 return 0;
}`;
try{
 fs.mkdirSync(path.join(d,'src'));fs.writeFileSync(path.join(d,'src/runtime.hpp'),rt);fs.writeFileSync(path.join(d,'test.cpp'),cpp);
 const c=cp.spawnSync(process.env.CXX||'c++',['-std=c++20','-O0','-g0','-I'+path.join(d,'src'),path.join(d,'test.cpp'),'-o',path.join(d,'test')],{cwd:d,encoding:'utf8'});
 assert.equal(c.status,0,c.stderr||String(c.error));
 const r=cp.spawnSync(path.join(d,'test'),[],{cwd:d,encoding:'utf8'});
 assert.equal(r.status,0,r.stderr||r.stdout||String(r.error));
 assert.match(r.stdout,/OBJ_SLOT_EVIDENCE_PASS/);
 console.log('OBJ_SLOT_V0385_PASS actual_opaque_pixel_bounds=2');
}finally{fs.rmSync(d,{recursive:true,force:true});}
