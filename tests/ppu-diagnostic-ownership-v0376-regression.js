'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),C=require('../forja65-core');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-ppu-owner-'));
try{
 const r=C.loadRom(C.makeSyntheticRom()),files=C.generateProject(r,C.analyze(r,64));
 fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'probe.cpp'),`#include "runtime.hpp"
#include <cassert>
#include <fstream>
#include <iterator>
int main(){std::string first,second;{SnesRuntime a,b;a.ppuPortWrite(0x212C,17);b.ppuPortWrite(0x212C,23);first=a.ppuTimelineFile;second=b.ppuTimelineFile;assert(first!=second);}
for(auto p:{first,second}){std::ifstream f(p);std::string s((std::istreambuf_iterator<char>(f)),{});assert(s.find("stale")==std::string::npos);assert(s.find("event,frame,")==0);assert(s.find("event,frame,",1)==std::string::npos);}
std::ifstream a(first),b(second);std::string x((std::istreambuf_iterator<char>(a)),{}),y((std::istreambuf_iterator<char>(b)),{});assert(x.find(",8492,17,")!=std::string::npos);assert(x.find(",8492,23,")==std::string::npos);assert(y.find(",8492,23,")!=std::string::npos);}
`);
 cp.execFileSync('g++',['-std=c++20','-O0',path.join(dir,'probe.cpp'),'-o',path.join(dir,'probe')],{stdio:'pipe'});
 const env={...process.env,FORJA65_PPU_TRACE:'1',FORJA65_PPU_TRACE_FILE:'ownership.csv'};
 fs.writeFileSync(path.join(dir,'ownership.csv'),'stale\n');
 for(let i=0;i<2;i++)cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,env,stdio:'pipe'});
 const cm=files['CMakeLists.txt'];assert(cm.includes('FORJA65_PPU_TRACE=0'));assert(cm.includes('FORJA65_PPU_TRACE_FILE=ppu-timeline-smoke.csv'));assert(!files['tests/ppu_timeline_smoke.cpp'].includes('remove('));
 // REV144 R2 deliberately validates the Release candidate BEFORE replacing
 // bin/game.exe. CTest uses its own built targets/assets; no exported exe
 // is needed by the PPU ownership probe. Keep that newer AOT guard intact.
 const release=files['BUILD-WINDOWS.cmd'];
 assert(release.indexOf('ctest --test-dir')<release.indexOf('copy /Y build-win\\Release\\game.exe'),'validate Release candidate before replacing executable');
 const quality=files['BUILD-QUALITY-WINDOWS.cmd'];
 assert(quality.includes('xcopy /E /I /Y assets bin-quality\\assets >nul || goto :err'),'quality export includes ROM assets');
 assert(quality.indexOf('xcopy /E /I /Y assets bin-quality\\assets')<quality.indexOf('ctest --test-dir'),'copy quality assets before diagnostic tests');
 console.log('PPU_DIAGNOSTIC_OWNERSHIP_V0376_PASS: separate owners, truncate per execution, CTest isolation');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
