'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require(process.env.FORJA65_SOURCE_CORE||'../forja65-core');
const r=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(r,F.analyze(r,128));
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-io-67-'));
try{
 for(const n of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(d,n),files['src/'+n]);
 fs.writeFileSync(path.join(d,'probe.cpp'),`
#include "runtime.hpp"
#include <iostream>
unsigned cases=0,failures=0;
void check(bool b,const char*label){cases++;if(!b){if(failures<8)std::cerr<<label<<"\\n";failures++;}}
int main(){
 ApuBridge h;
 for(bool corrected:{false,true})for(unsigned v=0;v<256;v++){
  h.correctedSpcSemantics=corrected;h.accurateSpcTiming=true;h.spc.control=0;h.spc.psw=0;
  h.spcWrite(0xf2,v);
  check(h.spcRead(0xf2)==v,"DSPADDR preserves eight bits");
  check(forja65SpcPeek(h,0xf2)==v,"DSPADDR predictor preserves eight bits");
  h.spc.pc=0x200;h.spc.ram[0x200]=0xe4;h.spc.ram[0x201]=0xf2;
  check(forja65SpcStep(h)==3,"MOV A,DSPADDR cycles");
  check(h.spc.a()==v&&(h.spc.psw&0x82)==((v&0x80)|(v?0:2)),"MOV A,DSPADDR result/flags");
  h.spc.pc=0x200;h.spc.ram[0x200]=0xe3;h.spc.ram[0x201]=0xf2;h.spc.ram[0x202]=3;h.spc.psw=0;
  unsigned predicted=forja65SpcPredictCycles(h);
  check(predicted==((v&0x80)?7u:5u),"BBS7 DSPADDR predicted duration");
  check(h.spc.pc==0x200&&h.spc.dspAddr==v,"Predictor has no bus side effects");
  check(forja65SpcStep(h)==predicted&&h.spc.pc==((v&0x80)?0x206:0x203),"BBS7 DSPADDR actual branch/duration");
  h.spc.pc=0x200;h.spc.ram[0x200]=0xab;h.spc.ram[0x201]=0xf2;h.spc.psw=0;
  forja65SpcStep(h);
  check(h.spcRead(0xf2)==((v+1)&255),"INC DSPADDR retains read-only selection bit");
  for(unsigned address:{0xf0u,0xf1u}){
   h.spc.ram[address]=v;h.spc.control=0;
   check(h.spcRead(address)==0,"TEST/CONTROL write-only read is zero");
   check(forja65SpcPeek(h,address)==0,"TEST/CONTROL predictor read is zero");
   check(h.spc.ram[address]==v,"I/O read preserves backing RAM");
  }
 }
 h.spcWrite(0xf2,0x2d);h.spcWrite(0xf3,0x5a);
 h.spcWrite(0xf2,0xad);check(h.spcRead(0xf2)==0xad,"DSPADDR high bit readback");
 check(h.spcRead(0xf3)==0x5a,"DSPDATA upper address read-only mirror");
 h.spcWrite(0xf3,0x99);check(h.dsp.readReg(0x2d)==0x5a,"DSPDATA upper address writes remain blocked");
 std::cout<<"SPC_IO_READBACK_V043667 cases="<<cases<<" failures="<<failures<<" default_and_corrected=1\\n";
 return failures?1:0;
}
`);
 for(const opt of ['-O0','-O2']){
  const exe=path.join(d,process.platform==='win32'?'probe.exe':'probe');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,'probe.cpp','-o',exe,...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{cwd:d,stdio:'pipe',timeout:120000});
  const out=cp.spawnSync(exe,[],{cwd:d,encoding:'utf8',timeout:60000});
  process.stdout.write(opt+' '+out.stdout);process.stderr.write(out.stderr||'');
  if(out.status!==0)process.exitCode=1;
 }
}finally{fs.rmSync(d,{recursive:true,force:true});}
