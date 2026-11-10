// REV198: aplica os filtros do port a um quadro PPM (sem janela) para comparar.
// uso: video_preview entrada.ppm saida_dir LxA [aspecto]
//  - quadros 512x448 com pixels duplicados 2x2 (saida do Snes9x) voltam a 256x224.
#include "forja_video.hpp"
#include <chrono>
#include <iostream>
#include <sstream>
using namespace forja65video;
static bool readPpm(const std::string& p,std::vector<std::uint32_t>& px,unsigned& w,unsigned& h){
  std::ifstream in(p,std::ios::binary);std::string mg;int mx;if(!(in>>mg>>w>>h>>mx)||mg!="P6")return false;in.get();
  px.resize((std::size_t)w*h);std::vector<unsigned char> b((std::size_t)w*h*3);in.read((char*)b.data(),(std::streamsize)b.size());
  for(std::size_t i=0;i<px.size();++i){px[i]=0xFF000000u|(b[3*i]<<16)|(b[3*i+1]<<8)|b[3*i+2];}
  return bool(in);
}
static void writePpm(const std::string& p,const std::uint32_t* px,unsigned w,unsigned h,unsigned stride){
  std::ofstream o(p,std::ios::binary);o<<"P6\n"<<w<<" "<<h<<"\n255\n";
  for(unsigned y=0;y<h;++y)for(unsigned x=0;x<w;++x){const auto v=px[(std::size_t)y*stride+x];char c[3]={(char)(v>>16),(char)(v>>8),(char)v};o.write(c,3);}
}
int main(int argc,char**argv){
  if(argc<4){std::cerr<<"uso: video_preview entrada.ppm saida_dir LxA [4:3|8:7|1:1]\n";return 2;}
  std::vector<std::uint32_t> px;unsigned w,h;if(!readPpm(argv[1],px,w,h)){std::cerr<<"PPM invalido\n";return 1;}
  if(w==512&&h==448){bool dup=true;for(unsigned y=0;y<h&&dup;y+=2)for(unsigned x=0;x<w;x+=2){const auto v=px[(std::size_t)y*w+x];
      if(px[(std::size_t)y*w+x+1]!=v||px[(std::size_t)(y+1)*w+x]!=v||px[(std::size_t)(y+1)*w+x+1]!=v){dup=false;break;}}
    if(dup){std::vector<std::uint32_t> q(256*224);for(unsigned y=0;y<224;++y)for(unsigned x=0;x<256;++x)q[y*256+x]=px[(std::size_t)(2*y)*w+2*x];px.swap(q);w=256;h=224;}}
  Settings s;if(!parseResolution(argv[3],s)){std::cerr<<"resolucao invalida\n";return 2;}
  if(argc>4)parseAspect(argv[4],s.aspect);
  const Resolution r=s.resolution();
  Renderer ren;
  std::cout<<"source="<<w<<"x"<<h<<" canvas="<<r.w<<"x"<<r.h<<" aspect="<<aspectKey(s.aspect)<<" threads="<<ren.threads()<<"\n";
  for(unsigned f=0;f<unsigned(Filter::Count);++f){
    s.filter=Filter(f);
    ren.render(px.data(),w,h,r.w,r.h,s); // aquece
    const auto t0=std::chrono::steady_clock::now();const int N=10;
    for(int i=0;i<N;++i)ren.render(px.data(),w,h,r.w,r.h,s);
    const double ms=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-t0).count()/N;
    const Rect q=ren.rect;
    std::ostringstream name;name<<argv[2]<<"/"<<f<<"-"<<filterKey(s.filter)<<".ppm";
    writePpm(name.str(),ren.frame().data()+(std::size_t)q.y*r.w+q.x,(unsigned)q.w,(unsigned)q.h,r.w);
    std::cout<<filterKey(s.filter)<<" rect="<<q.x<<","<<q.y<<","<<q.w<<"x"<<q.h<<" ms="<<ms<<"\n";
  }
}
