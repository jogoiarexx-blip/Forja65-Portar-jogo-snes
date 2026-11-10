'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require(process.env.FORJA65_SOURCE_CORE||'../forja65-core');
const r=F.loadRom(F.makeSyntheticRom()),p=F.generateProject(r,F.analyze(r,128));
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-tset-66-'));
try{
 for(const n of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(d,n),p['src/'+n]);
 fs.writeFileSync(path.join(d,'test.cpp'),`
#include "runtime.hpp"
#include <cassert>
#include <iostream>
int main(){
 ApuBridge h;unsigned cases=0;
 for(bool corrected:{false,true})for(unsigned op:{0x0eu,0x4eu})for(unsigned a=0;a<256;a++)for(unsigned m=0;m<256;m++){
  h.correctedSpcSemantics=corrected;h.accurateSpcTiming=true;
  h.spc.control=0;h.spc.pc=0x200;h.spc.setA(a);h.spc.psw=0x7d;
  h.spc.ram[0x200]=op;h.spc.ram[0x201]=0;h.spc.ram[0x202]=3;h.spc.ram[0x300]=m;
  unsigned result=(a-m)&255;
  unsigned expected=(0x7d&~0x82)|(result&0x80)|(result?0:2);
  assert(forja65SpcStep(h)==6);
  assert(h.spc.psw==expected);
  assert(h.spc.ram[0x300]==(op==0x0e?(m|a):(m&~a)));
  cases++;
 }
 // The reference bus sequence reads the operand twice before writing it.
 h.traceF3Bus=true;h.correctedSpcSemantics=true;h.spc.pc=0x200;h.spc.setA(1);
 h.spc.ram[0x200]=0x0e;h.spc.ram[0x201]=0xf3;h.spc.ram[0x202]=0;
 h.spc.dspAddr=0x5d;h.dsp.regs[0x5d]=2;
 assert(forja65SpcStep(h)==6);
 assert(h.f3BusTrace.size()==1);
 assert(h.f3BusTrace[0].ordinal==6&&h.f3BusTrace[0].totalAccesses==6);
 std::cout<<"SPC_TSET_TCLR_V043666_PASS cases="<<cases<<" reference_accesses=6 default_and_corrected=1\\n";
}
`);
 for(const opt of ['-O0','-O2']){
  const exe=path.join(d,process.platform==='win32'?'test.exe':'test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,'test.cpp','-o',exe,...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{cwd:d,stdio:'pipe',timeout:120000});
  process.stdout.write(opt+' '+cp.execFileSync(exe,[],{cwd:d,encoding:'utf8',timeout:60000}));
 }
}finally{fs.rmSync(d,{recursive:true,force:true});}
