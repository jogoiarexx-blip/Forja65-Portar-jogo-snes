'use strict';
// This test runs the generated C++ runtime (not a JavaScript reimplementation).
const assert=require('node:assert/strict');
const F=require('../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom());
const files=F.generateProject(rom,F.analyze(rom,128));
// Test-only instrumentation: count the actual accesses to the read-to-clear
// timer outputs, without adding overhead to the shipped runtime.
const field='timerOut[3]{}';
const read='std::uint8_t v = s.spc.timerOut[i] & 0x0F;';
assert.ok(files['src/runtime.hpp'].includes(field));
assert.ok(files['src/runtime.hpp'].includes(read));
const runtime=files['src/runtime.hpp']
  .replace(field,field+',timerReadCounts[3]{}')
  .replace(read,'++s.spc.timerReadCounts[i]; '+read);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-addw-read-once-'));
const source=String.raw`
int main(){
  unsigned cases=0;
  for(bool corrected:{false,true})for(unsigned addr:{0xFDu,0xFEu})
  for(unsigned lo=0;lo<16;lo++)for(unsigned hi=0;hi<16;hi++)
  for(unsigned oldYA:{0x0000u,0x7F00u,0x7FFFu,0x8000u,0xFFF0u,0xFFFFu,0x7000u}){
    ApuBridge s;
    s.correctedSpcSemantics=corrected;s.accurateSpcTiming=true;
    s.spc.control=0;
    s.spc.pc=0x200;
    s.spc.psw=0x14; // PB/I preserved, DP selects page zero.
    s.spc.ya=(std::uint16_t)oldYA;
    s.spc.ram[0x200]=0x7A; // ADDW YA,dp
    s.spc.ram[0x201]=(std::uint8_t)addr;
    for(unsigned i=0;i<3;i++)s.spc.timerOut[i]=0x0D;
    s.spc.timerOut[addr-0xFD]=(std::uint8_t)lo;
    s.spc.timerOut[addr-0xFD+1]=(std::uint8_t)hi;
    const unsigned operand=lo|(hi<<8);
    const unsigned sum=oldYA+operand;
    const unsigned result=sum&0xffffu;
    const unsigned expectedFlags=0x14u
      | ((result>>8)&0x80u)
      | (((~(oldYA^operand))&(oldYA^sum)&0x8000u)?0x40u:0u)
      | ((corrected&&((oldYA&0xfffu)+(operand&0xfffu)>0xfffu))?0x08u:0u)
      | (result==0?0x02u:0u)
      | (sum>0xffffu?0x01u:0u);
    const int cycles=forja65SpcStep(s);
    assert(cycles==5);
    assert(s.spc.pc==0x202u);
    assert(s.spc.ya==result);
    assert(s.spc.psw==expectedFlags);
    assert(s.spc.timerOut[addr-0xFD]==0);
    assert(s.spc.timerOut[addr-0xFD+1]==0);
    assert(s.spc.timerReadCounts[addr-0xFD]==1);
    assert(s.spc.timerReadCounts[addr-0xFD+1]==1);
    for(unsigned i=0;i<3;i++)if(i!=addr-0xFD&&i!=addr-0xFD+1)assert(s.spc.timerOut[i]==13);
    ++cases;
  }
  // Reading ordinary RAM continues to work and has identical arithmetic.
  for(bool corrected:{false,true}){
    ApuBridge s;s.correctedSpcSemantics=corrected;s.accurateSpcTiming=true;s.spc.control=0;s.spc.pc=0x200;
    s.spc.ram[0x200]=0x7A;s.spc.ram[0x201]=0x40;
    s.spc.ram[0x40]=1;s.spc.ram[0x41]=0;s.spc.ya=0x7fff;
    assert(forja65SpcStep(s)==5);
    assert(s.spc.ya==0x8000u && (s.spc.psw&0x40u));
    ++cases;
  }
  std::cout<<"SPC_ADDW_IO_READ_ONCE_V043640_PASS scenarios="<<cases
           <<" semantics=legacy/corrected timer_ports=FD/FE,FE/FF flags=NVHZC\n";
}
`;
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),runtime);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
  fs.writeFileSync(path.join(dir,'probe.cpp'),'#include "runtime.hpp"\n#include <cassert>\n#include <iostream>\n'+source);
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O2','-Wall','-Wextra','-Wpedantic','-Werror','probe.cpp','-o','probe'],{cwd:dir,stdio:'inherit'});
  cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,stdio:'inherit'});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('SPC_ADDW_READ_ONCE_BUILD_V043640_PASS');
