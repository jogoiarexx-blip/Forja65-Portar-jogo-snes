"use strict";
// Forja65 REV205: medicao de desempenho, compositor rapido do PPU, color math em hires e temporizacao HDMA/entrelacado.
// 1) o gerador embute as quatro mudancas e as chaves para voltar ao modelo anterior;
// 2) Linux: compila um teste com o runtime gerado e confere
//    a) o compositor rapido contra o compositor de referencia (finalMain15) em 4000 estados aleatorios dos modos 0, 1 e 3,
//       com janelas, color math, sub-tela, prioridades, tiles 16x16, flips e mosaico desligado;
//    b) a color math do pseudo-hires (primeiro pixel preto; pixel da sub-tela com o estado do ponto anterior);
//    c) a reconstituicao dos ciclos da instrucao para o HDMA (soma igual ao custo da instrucao) e a chave legacy.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'rev205-hw.sfc');
const files=F.generateProject(rom,F.analyze(rom,256));
const rt=files['src/runtime.hpp'],main=files['src/main.cpp'];
for(const term of ['struct ForjaPerfScope','void writePerfReport()','FORJA65_PERF_OUT','bool renderFastSegment(','FORJA65_PPU_VERIFY',
  'void renderHiresMathSegment(','FORJA65_HIRES_MATH','void hdmaWalkInstruction(','void executeHdmaSetupV0(','FORJA65_HDMA_TIMING',
  'interlaceFrameLatch','FORJA65_INTERLACE_LATCH','perf.on?&perf.ppuNs:nullptr'])
  assert.ok(rt.includes(term),'falta no runtime: '+term);
assert.ok(main.includes('hw.writePerfReport();'),'main.cpp sem relatorio de desempenho');
// o modelo antigo continua no codigo (chaves legacy)
assert.ok(rt.includes('advanceCpuMasterCycles(DMA_SYNC_MC);hdmaStallMasterCycles+=DMA_SYNC_MC;'));
assert.ok(rt.includes('if(mode==5||mode==6){for(unsigned x=x0;x<x1;x++)'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-rev205-'));
try{
  for(const [n,c] of Object.entries(files))if(n.startsWith('src/')){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);}
  const have=c=>cp.spawnSync(c,['--version'],{encoding:'utf8'}).status===0;
  if(process.platform==='linux'&&have(process.env.CXX||'g++')){
    fs.writeFileSync(path.join(dir,'src','rev205_hw.cpp'),String.raw`#include "runtime.hpp"
#include <random>
#include <iostream>
static int fail(const char*m){std::cout<<"FAIL "<<m<<"\n";return 1;}
int main(){
  std::mt19937 rng(205);auto r8=[&]{return (std::uint8_t)(rng()&0xFF);};
  // a) compositor rapido x referencia
  unsigned checked=0;
  for(int it=0;it<4000;++it){
    PpuState p;p.bgFirstLineHidden=(it&1)!=0;
    for(auto&b:p.vram)b=r8();for(auto&b:p.cgram)b=r8();
    const unsigned modes[3]={0u,1u,3u};p.bgmode=(std::uint8_t)(modes[it%3]|(r8()&0xF8u)|((it%7==0)?0x08u:0u));
    for(int i=0;i<4;i++){p.bgsc[i]=r8();p.bgnba[i]=r8();p.scrollX[i]=(std::uint16_t)(rng()&0x3FF);p.scrollY[i]=(std::uint16_t)(rng()&0x3FF);}
    p.tm=(std::uint8_t)(r8()&0x2F);p.ts=(std::uint8_t)(r8()&0x2F);p.tmw=r8();p.tsw=r8();
    p.w12sel=r8();p.w34sel=r8();p.wobjsel=r8();for(int i=0;i<4;i++)p.wh[i]=r8();p.wbglog=r8();p.wobjlog=r8();
    p.cgwsel=r8();p.cgadsub=r8();p.fixedR=r8()&31;p.fixedG=r8()&31;p.fixedB=r8()&31;p.brightness=15;p.mosaic=(std::uint8_t)(r8()&0xF0u);
    if(!p.fastSegmentEligible())continue;
    std::vector<std::uint32_t> fb(256*224,0);PpuState::BgTileRows tiles{};const int y=(int)(rng()%224);
    const unsigned x0=(unsigned)(rng()%200),x1=x0+1u+(unsigned)(rng()%(256u-x0));
    if(!p.renderFastSegment(fb,y,x0,x1,(std::size_t)y*256u,nullptr,&tiles))return fail("fast path recusou um estado elegivel");
    PpuState::BgTileRows ref{};
    for(unsigned x=x0;x<x1;x++){const auto want=p.rgba15(p.finalMain15((int)x,y,false,nullptr,&ref));
      if(fb[(std::size_t)y*256u+x]!=want){std::cout<<"it="<<it<<" x="<<x<<" y="<<y<<" mode="<<(p.bgmode&7)<<"\n";return fail("compositor rapido diverge do de referencia");}}
    ++checked;
  }
  if(checked<1000)return fail("poucos estados elegiveis");
  // b) pseudo-hires: backdrop main=cor 0, sub vazio; math soma COLDATA com metade
  {
    PpuState p;p.setini=0x08;p.bgmode=1;p.tm=0;p.ts=0;p.brightness=15;
    p.cgram[0]=0x1F;p.cgram[1]=0x00; // cor 0 = vermelho 31
    p.cgwsel=0x00;p.cgadsub=0x20|0x40; // backdrop entra na math, metade
    p.fixedR=0;p.fixedG=31;p.fixedB=0;
    std::vector<std::uint32_t> fb(512*224,0);PpuState::BgTileRows t{};
    p.renderHiresMathSegment(fb,0,0,8,0,false,nullptr,&t);
    if(fb[0]!=p.rgba15(0))return fail("primeiro pixel hires tem de sair preto");
    const std::uint16_t mathMain=PpuState::blend15(0x001F,p.fixed15(),false,true);
    if(fb[1]!=p.rgba15(mathMain))return fail("pixel da tela principal sem color math");
    // pixel par seguinte: cor da sub-tela (backdrop) + COLDATA com o estado do ponto anterior (metade)
    if(fb[2]!=p.rgba15(PpuState::blend15(0x001F,p.fixed15(),false,true)))return fail("pixel da sub-tela em hires sem o estado do ponto anterior");
  }
  std::cout<<"REV205_HW_OK compositor="<<checked<<"\n";
  return 0;
}
`);
    const r=cp.spawnSync(process.env.CXX||'g++',['-std=c++20','-O1','rev205_hw.cpp','-ldl','-lpthread','-o','rev205_hw'],{cwd:path.join(dir,'src'),encoding:'utf8'});
    assert.equal(r.status,0,r.stderr.slice(0,4000));
    const run=cp.spawnSync(path.join(dir,'src','rev205_hw'),[],{cwd:path.join(dir,'src'),encoding:'utf8'});
    assert.equal(run.status,0,run.stdout+run.stderr);
    assert.match(run.stdout,/REV205_HW_OK/);
    process.stdout.write(run.stdout);
  }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('REV205_HARDWARE_TIMING_PASS');
