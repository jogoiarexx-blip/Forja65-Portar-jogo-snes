'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),C=require('../forja65-core');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-autojoy-record-'));
try{
 const rom=C.loadRom(C.makeSyntheticRom()),files=C.generateProject(rom,C.analyze(rom,128));
 for(const name of ['runtime.hpp','forja_trace.hpp','forja_ir.hpp'])fs.writeFileSync(path.join(dir,name),files['src/'+name]);
 fs.writeFileSync(path.join(dir,'test.cpp'),`#include "runtime.hpp"
#include <cassert>
#include <fstream>
#include <iostream>
unsigned lines(const char*p){std::ifstream f(p);std::string s;unsigned n=0;while(std::getline(f,s))n++;return n;}
int main(){
 SnesRuntime rec;rec.headless=true;rec.io.setNmitimen(1);rec.frameCounter=0;
 rec.setInputRecordPath("begin.trace",true);rec.setJoy1(0x8000);rec.recordInputFrame();
 const auto ram=rec.ram;const auto clocks=rec.cpuInstructionCount;
 std::ofstream("automatic.trace")<<"stale-one\\nold-two\\nold-three\\n";
 setenv("FORJA65_AUTOJOY_RECORD","automatic.trace",1);
 rec.setJoy1(0x8100);rec.setJoy2(0x0040);rec.scheduleAutoJoyRead();rec.scheduleAutoJoyRead();
 assert(std::filesystem::exists("automatic.trace")&&"automatic sample trace missing");
 rec.setJoy1(0x8200);rec.setJoy2(0x0080);rec.finishAutoJoyRead(true);
 assert(rec.io.autoJoyLatched[0]==0x8100&&rec.io.autoJoyLatched[1]==0x0040);
 rec.frameCounter=1;rec.scheduleAutoJoyRead();rec.setJoy1(0x0800);rec.finishAutoJoyRead(true);
 assert(rec.io.autoJoyLatched[0]==0x8200&&rec.io.autoJoyLatched[1]==0x0080);
 assert(lines("automatic.trace")==3&&"new recording must replace stale content");rec.frameCounter=2;rec.io.setNmitimen(0);rec.scheduleAutoJoyRead();assert(lines("automatic.trace")==3);
 assert(rec.ram==ram&&rec.cpuInstructionCount==clocks);
 unsetenv("FORJA65_AUTOJOY_RECORD");
 SnesRuntime play;play.headless=true;play.io.setNmitimen(1);assert(play.loadInputReplay("automatic.trace"));
 play.frameCounter=0;assert(play.applyReplayInput());play.scheduleAutoJoyRead();play.finishAutoJoyRead(true);assert(play.io.autoJoyLatched[0]==0x8100&&play.io.autoJoyLatched[1]==0x0040);
 play.frameCounter=1;assert(play.applyReplayInput());play.scheduleAutoJoyRead();play.finishAutoJoyRead(true);assert(play.io.autoJoyLatched[0]==0x8200&&play.io.autoJoyLatched[1]==0x0080);
 SnesRuntime begin;assert(begin.loadInputReplay("begin.trace"));begin.frameCounter=0;begin.applyReplayInput();assert(begin.io.joy[0]==0x8000&&begin.io.joy[0]!=0x8100);
 rec.io.setNmitimen(1);unsigned aliases=0;auto reject=[&](const std::string&alias){rec.frameCounter++;setenv("FORJA65_AUTOJOY_RECORD",alias.c_str(),1);bool conflict=false;try{rec.scheduleAutoJoyRead();}catch(const std::exception&){conflict=true;}assert(conflict);aliases++;};
 reject("./begin.trace");reject(std::filesystem::absolute("begin.trace").string());
 std::error_code ec;std::filesystem::create_hard_link("begin.trace","hard.trace",ec);if(!ec)reject("hard.trace");
 ec.clear();std::filesystem::create_symlink("begin.trace","symbolic.trace",ec);if(!ec)reject("symbolic.trace");
 assert(lines("begin.trace")==2);std::cout<<"path_aliases="<<aliases<<"\\n";
 rec.frameCounter=100;setenv("FORJA65_AUTOJOY_RECORD","automatic.trace/child",1);bool failed=false;try{rec.scheduleAutoJoyRead();}catch(const std::exception&){failed=true;}assert(failed);
 std::cout<<"AUTOJOY_INPUT_RECORD_PASS snapshot_timing two_pads duplicate_frame disabled_autojoy readonly replay restart_file path_conflict io_error\\n";
}
`);
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-I',dir,path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{stdio:'inherit'});
 cp.execFileSync(path.join(dir,'test'),[],{cwd:dir,stdio:'inherit'});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
