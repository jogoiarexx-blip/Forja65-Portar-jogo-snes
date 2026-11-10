'use strict';
// REV196: S-DSP relogio a relogio sincronizado ao SPC700, ROM HiROM entrelacada e auditoria com o mapa do nucleo.
const assert=require('node:assert/strict');
const F=require('../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');

// 1) HiROM entrelacada (formato de copiadora): detectada, desentrelacada e igual a imagem normal
function synthHiRom(size){
  const d=new Uint8Array(size);for(let o=0;o<size;o+=4){d[o]=o>>>16;d[o+1]=(o>>>8)&255;d[o+2]=o&255;d[o+3]=0xA5;}
  const h=0xFFC0;d.fill(0,h-0x10,h+0x40);d.set(Buffer.from('FORJA INTERLEAVE TEST'),h);d[h+0x15]=0x21;d[h+0x17]=0x0B;d[h+0x19]=1;d[h+0x1A]=0x01;
  d[h+0x1C]=0xFF;d[h+0x1D]=0xFF;d[h+0x3C]=0x00;d[h+0x3D]=0x80;d[0x8000]=0x78;return d;
}
const plain=synthHiRom(0x200000),n=plain.length>>>16,inter=new Uint8Array(plain.length);
for(let i=0;i<n;i++){inter.set(plain.subarray((2*i+1)*0x8000,(2*i+2)*0x8000),i*0x8000);inter.set(plain.subarray(2*i*0x8000,(2*i+1)*0x8000),(n+i)*0x8000);}
{const a=F.loadRom(plain),b=F.loadRom(inter);
 assert.equal(a.header.deinterleaved,false);assert.equal(b.header.deinterleaved,true);assert.equal(b.header.mapping,'HiROM');
 assert.ok(Buffer.from(a.data).equals(Buffer.from(b.data)),'imagem desentrelacada deve ser identica');
 for(const addr of [0x008000,0x00FFC0,0x40ABCD,0xC12345,0x1F8000])assert.equal(F.snesToRom(b,addr),F.snesToRom(a,addr));
 assert.equal(F.loadRom(inter,'x',{deinterleave:false}).header.deinterleaved,false);}

// 2) auditoria estatica com o mapa do nucleo percorre ExHiROM (antes recusado)
{const d=new Uint8Array(0x600000),h=0x40FFC0;d.fill(0xEA);d.fill(0,h-0x10,h+0x40);d.set(Buffer.from('FORJA EXHIROM AUDIT  '),h);d[h+0x15]=0x25;d[h+0x17]=0x0D;
 d[h+0x1C]=0xFF;d[h+0x1D]=0xFF;d[h+0x3C]=0x00;d[h+0x3D]=0x80;d.set([0x78,0x18,0xFB,0x80,0xFE],0x408000);
 const A=require('../tools/snes-hardware-audit.js');
 const legacy=A.audit(Buffer.from(d),{max:200});assert.equal(legacy.scan,null);
 const core=A.audit(Buffer.from(d),{max:200,coreMapper:true});assert.equal(core.coreMapping.mapping,'ExHiROM');assert.ok(core.scan&&core.scan.decodedStates>=4&&core.scan.unmappedCodeStates===0);}

// 3) DSP por relogio: 32 passos == amostra inteira; 1 s = 32.040 amostras; sem escritas do SPC, PCM identico ao modo por amostra
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev196-'));
const src=String.raw`#include "runtime.hpp"
#include <cassert>
#include <iostream>
static void voice(ApuBridge&a){
  a.spc.control=0;a.spc.pc=0x200;a.spc.ram[0x200]=0x2F;a.spc.ram[0x201]=0xFE; // BRA $ (SPC sem escritas no DSP)
  a.dsp.cycleExactPipeline=true;a.setNativeDsp(true);a.enableMemoryPcmCapture(true);
  a.spc.ram[0x100]=0x00;a.spc.ram[0x101]=0x03;a.spc.ram[0x102]=0x00;a.spc.ram[0x103]=0x03;a.spc.ram[0x300]=0x03;for(int i=1;i<9;i++)a.spc.ram[0x300+i]=0x7A;
  auto w=[&](unsigned r,unsigned v){a.dsp.writeReg((std::uint8_t)r,(std::uint8_t)v,a.spc.ram);};
  w(0x6C,0x20);w(0x5D,1);w(0x0C,127);w(0x1C,127);w(0x00,100);w(0x01,90);w(0x02,0);w(0x03,0x10);w(0x05,0x8F);w(0x4C,1);
}
int main(){
  {SpcDsp x,y;std::vector<std::uint8_t> ram(65536,0x11);x.cycleExactPipeline=y.cycleExactPipeline=true;x.writeReg(0x4C,1,ram);y.writeReg(0x4C,1,ram);
   const std::function<void(unsigned)> none;for(int s=0;s<64;++s){auto a=x.renderPipelineSample(ram,none);std::array<std::int16_t,2> b{};for(int k=0;k<32;++k)if(y.stepPipelinePhase(ram))b=y.pLastOut;assert(a==b);}}
  ApuBridge p,q;voice(p);voice(q);q.phaseDspRequested=false;
  assert(p.phaseDspActive()&&!q.phaseDspActive());
  for(unsigned n=0;n<21477u;++n){p.tickMasterCycles(1000u);q.tickMasterCycles(1000u);}
  p.tickMasterCycles(272u);q.tickMasterCycles(272u);
  std::cout<<"phase_samples="<<p.dspNativeSamples<<" sample_samples="<<q.dspNativeSamples<<"\n";
  assert(p.dspNativeSamples==32040u&&q.dspNativeSamples==32040u);
  assert(p.nativePcm==q.nativePcm);bool any=false;for(auto v:p.nativePcm)if(v){any=true;break;}assert(any);
  std::cout<<"REV196_DSP_PHASE_PASS\n";
}`;
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
  fs.writeFileSync(path.join(dir,'probe.cpp'),src);
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra','-Werror','probe.cpp','-o','probe'],{cwd:dir,stdio:'inherit'});
  const env={...process.env};for(const k of Object.keys(env))if(/^FORJA65_(SPC|DSP|TIMING)/.test(k))delete env[k];
  const out=cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,env,encoding:'utf8'});
  assert.match(out,/REV196_DSP_PHASE_PASS/);
  console.log('REV196_DSP_PHASE_MAPPING_PASS interleaved=ok audit_core=ok dsp_phase=32040/s pcm=identico');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
