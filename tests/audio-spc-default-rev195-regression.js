'use strict';
// REV195: perfil SPC de referencia por padrao e S-DSP no relogio do SPC (1 amostra / 32 ciclos = 32.040 Hz).
// Mede no runtime gerado: perfil efetivo, amostras do DSP em 1 s NTSC e PAL, e os escapes de compatibilidade.
const assert=require('node:assert/strict');
const F=require('../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev195-audio-'));
const src=String.raw`#include "runtime.hpp"
#include <cassert>
#include <iostream>
int main(){
  ApuBridge a;std::cout<<"profile="<<a.spcProfileName()<<"\n";
  a.tickDspMasterCycles(21477272u);std::cout<<"ntsc_samples="<<a.dspFallbackSamples<<"\n";
  ApuBridge p;p.setClockRegion(true);p.tickDspMasterCycles(21281370u);std::cout<<"pal_samples="<<p.dspFallbackSamples<<"\n";
}`;
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
  fs.writeFileSync(path.join(dir,'probe.cpp'),src);
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra','-Werror','probe.cpp','-o','probe'],{cwd:dir,stdio:'inherit'});
  const run=(extra)=>{const env={...process.env};for(const k of Object.keys(env))if(/^FORJA65_(SPC|DSP|TIMING)/.test(k))delete env[k];
    const out=cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,env:{...env,...extra},encoding:'utf8'});
    return Object.fromEntries(out.trim().split('\n').map(l=>l.split('=')));};
  let r=run({});
  assert.equal(r.profile,'reference','padrao deve ser o perfil de referencia');
  assert.equal(r.ntsc_samples,'32040','1 s NTSC = 1.025.280/32 amostras');
  assert.equal(r.pal_samples,'32040','o ressonador do APU nao depende da regiao');
  r=run({FORJA65_SPC_PROFILE:'legacy'});assert.equal(r.profile,'legacy');
  r=run({FORJA65_DSP_RATE:'32000'});assert.equal(r.ntsc_samples,'32000');
  r=run({FORJA65_TIMING_PROFILE:'rev142'});assert.equal(r.profile,'legacy','rev142 reproduz o SPC antigo');assert.equal(r.ntsc_samples,'32000');
  r=run({FORJA65_TIMING_PROFILE:'rev142',FORJA65_SPC_PROFILE:'reference'});assert.equal(r.profile,'reference','chave explicita tem prioridade');
  const hdr=files['src/pcm_audio_output.hpp'];assert(hdr.includes('usando 48000 Hz'),'fallback de 48 kHz no WinMM');
  assert(files['src/runtime.hpp'].includes('forja65-audio-error.txt')||Object.values(files).some(v=>typeof v==='string'&&v.includes('forja65-audio-error.txt')),'aviso de audio mudo');
  console.log('AUDIO_SPC_DEFAULT_REV195_PASS reference 32040/s NTSC e PAL; legacy, DSP 32000 e rev142 preservados');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
