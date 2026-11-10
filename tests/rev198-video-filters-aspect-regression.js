'use strict';
// REV198: pipeline de video do host - filtros (sharp, FXAA, Scale2x/3x, CRT, LCD, CAS...) e resolucao
// escolhida sempre com a imagem 4:3 (ou 8:7/1:1) sem distorcao. Testa o cabecalho embutido no runtime.hpp.
const assert=require('node:assert/strict');
const F=require('../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,128));
const rt=files['src/runtime.hpp'];
// integracao no port gerado
for(const q of ['namespace forja65video','std::shared_ptr<forja65video::WinHost> video;','video->attach(hwnd)',
  'if(video&&video->handleMessage(msg))continue;','video->present(framebuffer.data(),fbWidth,fbHeight)','if(m==WM_ERASEBKGND)return 1;',
  // caminho antigo continua disponivel com FORJA65_VIDEO_LEGACY=1
  'fitClientToIntegerScale(256,224)','StretchDIBits(dc,dx,dy,dw,dh'])assert.ok(rt.includes(q),'runtime.hpp sem: '+q);
const a=rt.indexOf('// Forja65 REV198: pipeline de video'),b=rt.indexOf('} // namespace forja65video');
assert.ok(a>=0&&b>a);
const embedded=rt.slice(a,b+'} // namespace forja65video'.length);
const canon=fs.readFileSync(path.join(__dirname,'../tools/rev198/forja_video.hpp'),'utf8');
// REV204: o runtime acrescenta a apresentacao pela GPU e as opcoes backend/gpu/vsync ao cabecalho da REV198.
// A parte da REV198 que nao muda (geometria, threads, filtros, Renderer, BMP) tem de continuar identica ao canonico.
const g0=embedded.indexOf('// ---------------------------------------------------------------- geometria'),g1=embedded.indexOf('// ---------------------------------------------------------------- GPU (REV204)');
assert.ok(g0>=0&&g1>g0,'marcos da REV198/REV204 ausentes');
assert.ok(canon.includes(embedded.slice(g0,g1).replace(/#if \(defined\(_WIN32\)\|\|defined\(__linux__\)\)&&!defined\(FORJA65_VIDEO_NO_GPU\)\n$/,'')),'tools/rev198/forja_video.hpp e o cabecalho embutido divergem (rode tools/rev198/embed-video.py)');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev198-'));
const src=String.raw`#include "video.hpp"
#include <cassert>
#include <iostream>
using namespace forja65video;
static std::vector<std::uint32_t> pattern(unsigned w,unsigned h){
  std::vector<std::uint32_t> p((std::size_t)w*h);
  for(unsigned y=0;y<h;++y)for(unsigned x=0;x<w;++x){
    std::uint32_t c=0xFF203040u;
    if(x+y/2<160u&&x+y/2>100u)c=0xFFFFFFFFu;            // diagonal em escada
    if(((x/16)+(y/16))%5==0)c=0xFFC02010u;               // blocos
    p[(std::size_t)y*w+x]=c;}
  return p;
}
static bool ratio43(const Rect& r){return std::abs(r.w*3-r.h*4)<=3;}
int main(){
  // 1) geometria: 4:3 sem distorcao para 256x224, 256x239 (overscan) e 512x448 (hires+entrelacado)
  Settings s;
  for(auto sz:{std::pair<unsigned,unsigned>{256,224},{256,239},{512,448},{512,224}}){
    Rect r=imageRect(1920,1080,sz.first,sz.second,s);assert(r.w==1440&&r.h==1080&&r.x==240&&r.y==0);}
  {Rect r=imageRect(1280,1024,256,224,s);assert(r.w==1280&&r.h==960&&r.y==32);}
  s.aspect=Aspect::Square;{Rect r=imageRect(1920,1080,256,224,s);assert(r.h==1080&&r.w==1234);}
  s.aspect=Aspect::Par87;{Rect r=imageRect(1920,1080,256,224,s);assert(r.h==1080&&r.w==1410);}
  s.aspect=Aspect::FourThree;
  assert(parseResolution("1280x960",s));{Rect r=imageRect(1920,1080,256,224,s);assert(r.w==1280&&r.h==960&&r.x==320&&r.y==60);}
  assert(parseResolution("2880x2160",s));{Rect r=imageRect(1920,1080,256,224,s);assert(r.w==1440&&r.h==1080);}   // reduz para caber
  assert(parseResolution("1000x1000",s)&&s.customW==1000);{Rect r=imageRect(1920,1080,256,224,s);assert(ratio43(r)&&r.w==1000&&r.h==750);} // fora da lista: encaixa
  for(std::size_t i=1;i<resolutions().size();++i)assert(resolutions()[i].w*3==resolutions()[i].h*4);
  assert(parseResolution("auto",s)&&s.resIndex==0&&s.customW==0);
  {Resolution c=windowClientFor(s,1800,1000);assert(c.h==896&&c.w==1195);}
  {Settings q;q.resIndex=6;Resolution c=windowClientFor(q,1200,700);assert(c.h<=700&&std::abs(int(c.w*3)-int(c.h*4))<=3);}
  // 2) configuracoes: arquivo + ambiente
  {Settings q;q.filter=Filter::Crt;q.resIndex=8;q.aspect=Aspect::Par87;q.crtMask=55;assert(saveSettings(q,"v.ini"));
   Settings r=loadSettings("v.ini");assert(r.filter==Filter::Crt&&r.resIndex==8&&r.aspect==Aspect::Par87&&r.crtMask==55);
   setenv("FORJA65_VIDEO_FILTER","fxaa",1);setenv("FORJA65_VIDEO_RESOLUTION","960x720",1);r=loadSettings("v.ini");
   assert(r.filter==Filter::Fxaa&&r.resolution().w==960&&r.aspect==Aspect::Par87);unsetenv("FORJA65_VIDEO_FILTER");unsetenv("FORJA65_VIDEO_RESOLUTION");
   Filter f;for(unsigned i=0;i<unsigned(Filter::Count);++i){assert(parseFilter(filterKey(Filter(i)),f)&&f==Filter(i));}}
  // 3) filtros: deterministicos, iguais com e sem threads, bordas pretas, cor lisa preservada
  const auto p=pattern(256,224);std::vector<std::uint32_t> flat(256*224,0xFF5080A0u);
  Renderer r0(0),r3(3);
  for(unsigned i=0;i<unsigned(Filter::Count);++i){
    Settings q;q.filter=Filter(i);
    r0.render(p.data(),256,224,1280,768,q);const auto a=r0.frame();r3.render(p.data(),256,224,1280,768,q);
    assert(a==r3.frame());r3.render(p.data(),256,224,1280,768,q);assert(a==r3.frame());
    assert(r0.rect.w==1024&&r0.rect.h==768&&r0.rect.x==128);
    for(unsigned y=0;y<768;y+=7){assert(a[y*1280u+5]==0xFF000000u);assert(a[y*1280u+1275]==0xFF000000u);}
    if(q.filter!=Filter::Crt&&q.filter!=Filter::Lcd){r0.render(flat.data(),256,224,1024,768,q);for(auto v:r0.frame())assert(v==0xFF5080A0u);}
  }
  // 4) sharp-bilinear em escala inteira = pixel exato; FXAA e Scale2x suavizam a escada
  {Settings q;q.aspect=Aspect::Square;q.filter=Filter::Sharp;Renderer r(0);r.render(p.data(),256,224,1024,896,q);
   for(unsigned y=0;y<896;++y)for(unsigned x=0;x<1024;++x)assert(r.frame()[y*1024u+x]==p[(y/4)*256u+x/4]);}
  auto mixed=[&](Filter f){Settings q;q.filter=f;q.aspect=Aspect::Square;Renderer r(0);r.render(p.data(),256,224,1024,896,q);
    std::set<std::uint32_t> pal(p.begin(),p.end());unsigned n=0;for(auto v:r.frame())if(!pal.count(v))++n;return n;};
  const unsigned nNear=mixed(Filter::Nearest),nFxaa=mixed(Filter::Fxaa),nS2=mixed(Filter::Scale2x),nS3=mixed(Filter::Scale3x);
  std::cout<<"mixed nearest="<<nNear<<" fxaa="<<nFxaa<<" scale2x="<<nS2<<" scale3x="<<nS3<<"\n";
  assert(nNear==0&&nFxaa>2000);
  {Settings q;q.filter=Filter::Scale2x;q.aspect=Aspect::Square;Renderer r(0),n(0);r.render(p.data(),256,224,512,448,q);q.filter=Filter::Nearest;n.render(p.data(),256,224,512,448,q);
   unsigned d=0;for(std::size_t i=0;i<r.frame().size();++i)d+=r.frame()[i]!=n.frame()[i];assert(d>100);}
  // 5) BMP de captura
  {Settings q;Renderer r(0);r.render(p.data(),256,224,640,480,q);assert(writeBmp("shot.bmp",r.frame().data(),640,480,640));
   std::ifstream b("shot.bmp",std::ios::binary|std::ios::ate);assert((unsigned)b.tellg()==54u+640u*3u*480u);}
  std::cout<<"REV198_VIDEO_PASS\n";
}`;
try{
  fs.writeFileSync(path.join(dir,'video.hpp'),'#pragma once\n#include <set>\n'+embedded+'\n');
  fs.writeFileSync(path.join(dir,'probe.cpp'),src);
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O2','-Wall','-Wextra','-Werror','-DFORJA65_VIDEO_NO_GPU','probe.cpp','-o','probe','-pthread'],{cwd:dir,stdio:'inherit'});
  const env={...process.env};for(const k of Object.keys(env))if(/^FORJA65_VIDEO/.test(k))delete env[k];
  const out=cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,env,encoding:'utf8'});
  assert.match(out,/REV198_VIDEO_PASS/);
  console.log('REV198_VIDEO_FILTERS_ASPECT_PASS geometria=4:3 filtros=10 threads=deterministico '+out.split('\n')[0]);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
