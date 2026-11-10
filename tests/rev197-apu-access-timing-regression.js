'use strict';
// REV197: instantes de acesso CPU<->SPC700 e leituras de timer no ciclo certo (modelo do bsnes: o SMP le
// $F4-$F7 no meio do ciclo, demais leituras no fim; a CPU escreve no fim do ciclo de escrita).
const assert=require('node:assert/strict');
const F=require('../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev197-'));
const src=String.raw`#include "runtime.hpp"
#include <cassert>
#include <iostream>
static void prog(ApuBridge&a,std::initializer_list<std::uint8_t> code){a.spc.control=0;a.spc.pc=0x200;std::uint16_t p=0x200;for(auto b:code)a.spc.ram[p++]=b;}
int main(){
  // 1) ciclo da leitura por instrucao (tabela tirada da ordem de acessos do bsnes)
  {ApuBridge a;prog(a,{0xE4,0xF4});assert(forja65SpcReadPrefix(a,0xF4,0xF7)==3);assert(forja65SpcPortReadPrefix2(a)==5);}
  {ApuBridge a;prog(a,{0x78,0x10,0xF5});assert(forja65SpcReadPrefix(a,0xF4,0xF7)==4);}          // CMP dp,#imm: endereco no 2o byte
  {ApuBridge a;prog(a,{0xBA,0xF3});assert(forja65SpcReadPrefix(a,0xF4,0xF7)==5);}               // MOVW YA,$F3: $F4 no ciclo 5
  {ApuBridge a;prog(a,{0xC4,0xF4});assert(forja65SpcReadPrefix(a,0xF4,0xF7)==-1);}              // escrita nao conta
  {ApuBridge a;prog(a,{0xE4,0xF4});a.spc.psw|=0x20;assert(forja65SpcReadPrefix(a,0xF4,0xF7)==-1);} // P=1: pagina 1
  {ApuBridge a;prog(a,{0xE5,0xFD,0x00});assert(forja65SpcReadPrefix(a,0xFD,0xFF)==4);}
  // 2) escrita da CPU entre a leitura (meio do ciclo 3) e o fim (ciclo 3) de MOV A,$F4: o SPC ve o valor antigo
  for(int mode=0;mode<2;++mode){
    ApuBridge a;a.cpuWriteLookahead=(mode==0);prog(a,{0xE4,0xF4,0x2F,0xFC});a.spc.portIn[0]=0x11;a.spc.setA(0);
    const std::int64_t hz=(std::int64_t)a.masterClockHz;a.ntscCycleCredit=hz*13/5;      // 2,6 ciclos decorridos
    a.write(0,0x55);
    if(mode==0){assert(a.cpuWriteLookaheads==1);assert(a.spc.a()==0x11);assert(a.ntscCycleCredit<0);}
    else{assert(a.spc.a()==0);a.tickMasterCycles(64);assert(a.spc.a()==0x55);}
  }
  // 3) leitura de $FD ve o tique de timer que ocorre no 2o ciclo da propria instrucao
  for(int mode=0;mode<2;++mode){
    ApuBridge a;a.spcTimerReadTiming=(mode==0);prog(a,{0xE4,0xFD});
    a.spc.timersOn[0]=true;a.spc.timerTarget[0]=1;a.spc.timerStage[0]=0;a.spc.timerOut[0]=0;a.spc.timerDiv[0]=126;
    forja65SpcStep(a);
    assert(a.spc.a()==(mode==0?1u:0u));
    assert(a.spc.timerDiv[0]==1);                                                        // custo total cobrado uma vez
  }
  std::cout<<"REV197_APU_ACCESS_PASS\n";
}`;
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
  fs.writeFileSync(path.join(dir,'probe.cpp'),src);
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra','-Werror','probe.cpp','-o','probe'],{cwd:dir,stdio:'inherit'});
  const env={...process.env};for(const k of Object.keys(env))if(/^FORJA65_(SPC|DSP|TIMING|APU)/.test(k))delete env[k];
  const out=cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,env,encoding:'utf8'});
  assert.match(out,/REV197_APU_ACCESS_PASS/);
  console.log('REV197_APU_ACCESS_TIMING_PASS prefix=ok cpu_write_lookahead=ok timer_read=ok');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
