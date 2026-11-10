#pragma once
// Forja65 REV198: pipeline de video do host (filtros + resolucao 4:3 sem distorcao).
// So le o framebuffer ja pronto do PPU (0xFFRRGGBB); nao toca em estado do SNES.
// A parte de geometria/filtros e independente de plataforma (testada no Linux);
// a parte de janela (WinHost) so existe no Windows.
#include <algorithm>
#include <array>
#include <atomic>
#include <cctype>
#include <cmath>
#include <condition_variable>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

namespace forja65video {

enum class Filter : unsigned { Sharp, Nearest, Bilinear, Fxaa, Scale2x, Scale3x, Scale3xFxaa, Crt, Lcd, Cas, Count };
enum class Aspect : unsigned { FourThree, Par87, Square, Count };

inline const char* filterKey(Filter f){
  static const char* k[]={"sharp","nearest","bilinear","fxaa","scale2x","scale3x","scale3x-fxaa","crt","lcd","cas"};
  return k[std::min<unsigned>(unsigned(f),unsigned(Filter::Count)-1u)];
}
inline const char* filterLabel(Filter f){
  static const char* k[]={"Sharp bilinear","Nearest","Bilinear","FXAA","Scale2x","Scale3x","Scale3x + FXAA","CRT","LCD","Bilinear + CAS"};
  return k[std::min<unsigned>(unsigned(f),unsigned(Filter::Count)-1u)];
}
inline const char* aspectKey(Aspect a){
  static const char* k[]={"4:3","8:7","1:1"};
  return k[std::min<unsigned>(unsigned(a),unsigned(Aspect::Count)-1u)];
}

struct Resolution { unsigned w, h; };
// Indice 0 = automatico (maior 4:3 que cabe na janela/tela). Todas as outras sao 4:3 exatas.
inline const std::vector<Resolution>& resolutions(){
  static const std::vector<Resolution> r={{0,0},{640,480},{800,600},{960,720},{1024,768},{1152,864},{1280,960},
    {1400,1050},{1440,1080},{1600,1200},{1920,1440},{2048,1536},{2880,2160}};
  return r;
}

struct Settings {
  Filter filter{Filter::Sharp};
  Aspect aspect{Aspect::FourThree};
  unsigned resIndex{0};          // 0 = auto
  unsigned customW{0}, customH{0}; // FORJA65_VIDEO_RESOLUTION=WxH fora da lista
  bool fullscreen{false};
  bool legacy{false};            // FORJA65_VIDEO_LEGACY=1: escala inteira antiga (StretchDIBits)
  unsigned crtMask{70};          // % de brilho dos subpixels apagados da mascara CRT
  unsigned sharpen{60};          // % do CAS
  Resolution resolution()const{
    if(customW&&customH)return {customW,customH};
    const auto& r=resolutions();return r[std::min<std::size_t>(resIndex,r.size()-1)];
  }
};

inline std::string lower(std::string s){for(auto& c:s)c=(char)std::tolower((unsigned char)c);return s;}
inline bool parseFilter(const std::string& v,Filter& out){
  const std::string s=lower(v);
  for(unsigned i=0;i<unsigned(Filter::Count);++i)if(s==filterKey(Filter(i))||s==std::to_string(i)){out=Filter(i);return true;}
  if(s=="sharp-bilinear"){out=Filter::Sharp;return true;}
  if(s=="epx"||s=="advmame2x"){out=Filter::Scale2x;return true;}
  if(s=="advmame3x"){out=Filter::Scale3x;return true;}
  return false;
}
inline bool parseAspect(const std::string& v,Aspect& out){
  const std::string s=lower(v);
  if(s=="4:3"||s=="43"||s=="4x3"||s=="tv"){out=Aspect::FourThree;return true;}
  if(s=="8:7"||s=="87"||s=="par"){out=Aspect::Par87;return true;}
  if(s=="1:1"||s=="11"||s=="square"||s=="pixel"){out=Aspect::Square;return true;}
  return false;
}
// "auto", indice da lista, ou LxA (qualquer tamanho; a imagem e encaixada sem distorcer).
inline bool parseResolution(const std::string& v,Settings& s){
  const std::string t=lower(v);
  if(t=="auto"||t=="0"){s.resIndex=0;s.customW=s.customH=0;return true;}
  const auto x=t.find('x');
  if(x!=std::string::npos){
    const unsigned w=(unsigned)std::strtoul(t.substr(0,x).c_str(),nullptr,10),h=(unsigned)std::strtoul(t.substr(x+1).c_str(),nullptr,10);
    if(w<160||h<120||w>16384||h>16384)return false;
    const auto& r=resolutions();
    for(unsigned i=1;i<r.size();++i)if(r[i].w==w&&r[i].h==h){s.resIndex=i;s.customW=s.customH=0;return true;}
    s.resIndex=0;s.customW=w;s.customH=h;return true;
  }
  char* end=nullptr;const unsigned long i=std::strtoul(t.c_str(),&end,10);
  if(end&&*end==0&&i<resolutions().size()){s.resIndex=(unsigned)i;s.customW=s.customH=0;return true;}
  return false;
}
inline std::string resolutionText(const Settings& s){
  const Resolution r=s.resolution();
  if(!r.w)return "auto";
  return std::to_string(r.w)+"x"+std::to_string(r.h);
}

inline void applyKey(Settings& s,const std::string& k,const std::string& v){
  if(k=="filter")parseFilter(v,s.filter);
  else if(k=="aspect")parseAspect(v,s.aspect);
  else if(k=="resolution")parseResolution(v,s);
  else if(k=="fullscreen")s.fullscreen=(v=="1"||lower(v)=="true"||lower(v)=="on");
  else if(k=="legacy")s.legacy=(v=="1");
  else if(k=="crt_mask"){const long n=std::strtol(v.c_str(),nullptr,10);if(n>=0&&n<=100)s.crtMask=(unsigned)n;}
  else if(k=="sharpen"){const long n=std::strtol(v.c_str(),nullptr,10);if(n>=0&&n<=100)s.sharpen=(unsigned)n;}
}
inline std::string trim(const std::string& s){std::size_t a=0,b=s.size();while(a<b&&std::isspace((unsigned char)s[a]))++a;while(b>a&&std::isspace((unsigned char)s[b-1]))--b;return s.substr(a,b-a);}
inline Settings loadSettings(const std::string& path="forja65-video.ini",bool useEnv=true){
  Settings s;
  std::ifstream in(path);std::string line;
  while(in&&std::getline(in,line)){
    line=trim(line);if(line.empty()||line[0]=='#'||line[0]==';'||line[0]=='[')continue;
    const auto eq=line.find('=');if(eq==std::string::npos)continue;
    applyKey(s,lower(trim(line.substr(0,eq))),trim(line.substr(eq+1)));
  }
  // variaveis de ambiente tem prioridade sobre o .ini
  static const char* env[][2]={{"FORJA65_VIDEO_FILTER","filter"},{"FORJA65_VIDEO_ASPECT","aspect"},{"FORJA65_VIDEO_RESOLUTION","resolution"},
    {"FORJA65_VIDEO_FULLSCREEN","fullscreen"},{"FORJA65_VIDEO_LEGACY","legacy"},{"FORJA65_VIDEO_CRT_MASK","crt_mask"},{"FORJA65_VIDEO_SHARPEN","sharpen"}};
  if(useEnv)for(auto& e:env)if(const char* v=std::getenv(e[0]))if(*v)applyKey(s,e[1],v);
  return s;
}
inline bool saveSettings(const Settings& s,const std::string& path="forja65-video.ini"){
  std::ofstream o(path,std::ios::trunc);if(!o)return false;
  o<<"# Forja65 video (REV198). F7/Shift+F7 filtro, F8/Shift+F8 resolucao, F10 aspecto, F11 tela cheia, F12 captura.\n";
  o<<"# filter: sharp nearest bilinear fxaa scale2x scale3x scale3x-fxaa crt lcd cas\n";
  o<<"# resolution: auto ou LxA (640x480 800x600 960x720 1024x768 1152x864 1280x960 1400x1050 1440x1080 1600x1200 1920x1440 2048x1536 2880x2160)\n";
  o<<"# aspect: 4:3 (TV) 8:7 (pixel do SNES) 1:1 (pixel quadrado)\n";
  o<<"filter="<<filterKey(s.filter)<<"\nresolution="<<resolutionText(s)<<"\naspect="<<aspectKey(s.aspect)
   <<"\nfullscreen="<<(s.fullscreen?1:0)<<"\ncrt_mask="<<s.crtMask<<"\nsharpen="<<s.sharpen<<"\n";
  return bool(o);
}

// ---------------------------------------------------------------- geometria
struct Rect { int x{}, y{}, w{}, h{}; bool operator==(const Rect& o)const{return x==o.x&&y==o.y&&w==o.w&&h==o.h;} };

// Tamanho logico da imagem do SNES: 512 de largura = hires, >=400 linhas = entrelacado.
inline void logicalSize(unsigned fbW,unsigned fbH,unsigned& lw,unsigned& lh){lw=fbW>=512u?fbW/2u:fbW;lh=fbH>=400u?fbH/2u:fbH;if(!lw)lw=256;if(!lh)lh=224;}
// Proporcao de exibicao (largura/altura) como fracao.
inline void displayRatio(unsigned fbW,unsigned fbH,Aspect a,unsigned& num,unsigned& den){
  unsigned lw,lh;logicalSize(fbW,fbH,lw,lh);
  if(a==Aspect::FourThree){num=4;den=3;}
  else if(a==Aspect::Par87){num=lw*8u;den=lh*7u;}
  else {num=lw;den=lh;}
}
// Maior retangulo num:den que cabe em boxW x boxH, centrado. Nunca distorce.
inline Rect fitAspect(int boxW,int boxH,unsigned num,unsigned den){
  Rect r;if(boxW<=0||boxH<=0||!num||!den)return r;
  long long w=boxW,h=(long long)boxW*den/num;
  if(h>boxH){h=boxH;w=(long long)boxH*num/den;}
  r.w=(int)std::max<long long>(1,w);r.h=(int)std::max<long long>(1,h);
  r.x=(boxW-r.w)/2;r.y=(boxH-r.h)/2;return r;
}
// Retangulo da imagem dentro da area cliente (cw x ch).
inline Rect imageRect(int cw,int ch,unsigned fbW,unsigned fbH,const Settings& s){
  int bw=cw,bh=ch;
  const Resolution res=s.resolution();
  if(res.w&&res.h){
    // resolucao escolhida; se nao couber (tela menor), reduz mantendo a proporcao
    Rect box=fitAspect(cw,ch,res.w,res.h);
    if((int)res.w<=cw&&(int)res.h<=ch){box.w=(int)res.w;box.h=(int)res.h;}
    bw=box.w;bh=box.h;
  }
  unsigned num,den;displayRatio(fbW,fbH,s.aspect,num,den);
  Rect r=fitAspect(bw,bh,num,den);
  r.x=(cw-r.w)/2;r.y=(ch-r.h)/2;return r;
}
// Area cliente da janela para a resolucao escolhida (auto = maior multiplo inteiro de 224 linhas que cabe).
inline Resolution windowClientFor(const Settings& s,unsigned availW,unsigned availH){
  Resolution r=s.resolution();
  if(!r.w){
    unsigned sc=std::max(1u,std::min(availH/224u,(availW*3u)/(224u*4u)));sc=std::min(sc,8u);
    r={(224u*sc*4u+1u)/3u,224u*sc};
  }
  if(r.w>availW||r.h>availH){const Rect f=fitAspect((int)availW,(int)availH,r.w,r.h);r={(unsigned)f.w,(unsigned)f.h};}
  return r;
}

// ---------------------------------------------------------------- threads
class RowPool {
public:
  explicit RowPool(unsigned n=~0u){
    if(n==~0u){
      const unsigned hc=std::thread::hardware_concurrency();n=hc>1?std::min(hc-1u,7u):0u;
      if(const char* e=std::getenv("FORJA65_VIDEO_THREADS"))if(*e)n=std::min(15u,(unsigned)std::strtoul(e,nullptr,10));
    }
    for(unsigned i=0;i<n;++i)workers.emplace_back([this,i]{loop(i);});
  }
  RowPool(const RowPool&)=delete;RowPool& operator=(const RowPool&)=delete;
  ~RowPool(){{std::lock_guard<std::mutex> l(m);quit=true;}cv.notify_all();for(auto& t:workers)t.join();}
  unsigned threads()const{return (unsigned)workers.size()+1u;}
  // fn(y0,y1) para faixas de linhas; bloqueia ate todas terminarem.
  void run(unsigned rows,const std::function<void(unsigned,unsigned)>& fn){
    const unsigned parts=std::min<unsigned>(threads(),std::max(1u,rows/16u));
    if(parts<=1){fn(0,rows);return;}
    {std::lock_guard<std::mutex> l(m);job=&fn;total=rows;nparts=parts;pending=parts-1;++gen;}
    cv.notify_all();
    fn(0,rows/parts);
    std::unique_lock<std::mutex> l(m);done.wait(l,[&]{return pending==0;});job=nullptr;
  }
private:
  void loop(unsigned i){
    unsigned seen=0;
    for(;;){
      std::unique_lock<std::mutex> l(m);
      cv.wait(l,[&]{return quit||gen!=seen;});
      if(quit)return;
      seen=gen;
      const auto* f=job;const unsigned P=nparts,T=total;
      const bool mine=(i+1u)<P;
      l.unlock();
      if(mine)(*f)(T*(i+1u)/P,T*(i+2u)/P);
      if(!mine)continue;
      l.lock();
      if(--pending==0)done.notify_one();
    }
  }
  std::vector<std::thread> workers;
  std::mutex m;std::condition_variable cv,done;
  const std::function<void(unsigned,unsigned)>* job{};
  unsigned total{},nparts{},pending{},gen{};
  bool quit{};
};

// ---------------------------------------------------------------- filtros
struct Tap { int i0, i1, w; }; // w = peso de i1 (0..256)
enum class TapMode { Nearest, Bilinear, Sharp };

inline void buildTaps(std::vector<Tap>& t,unsigned srcN,unsigned dstN,TapMode mode){
  t.resize(dstN);
  if(!srcN||!dstN)return;
  const double s=double(dstN)/double(srcN);
  for(unsigned x=0;x<dstN;++x){
    const double u=(x+0.5)/s; // coordenada na origem; texel i ocupa [i,i+1)
    if(mode==TapMode::Nearest){const int i=std::min<int>((int)srcN-1,(int)std::floor(u));t[x]={i,i,0};continue;}
    double mu=u;
    if(mode==TapMode::Sharp&&s>1.0){
      // sharp-bilinear: interpola so na faixa de ~1 pixel de destino entre texels
      const double fl=std::floor(u),cd=u-fl-0.5,rr=0.5-0.5/s;
      const double f=(cd-std::clamp(cd,-rr,rr))*s+0.5;mu=fl+f;
    }
    const double p=mu-0.5,f0=std::floor(p);
    int i0=(int)f0,i1=i0+1;int w=(int)std::lround((p-f0)*256.0);
    if(w>=256){i0=i1;w=0;}
    i0=std::clamp(i0,0,(int)srcN-1);i1=std::clamp(i1,0,(int)srcN-1);
    t[x]={i0,i1,w};
  }
}
inline std::uint32_t lerp(std::uint32_t a,std::uint32_t b,int w){
  if(!w||a==b)return a;
  const std::uint32_t iw=256u-(unsigned)w,uw=(unsigned)w;
  const std::uint32_t rb=(((a&0xFF00FFu)*iw+(b&0xFF00FFu)*uw)>>8)&0xFF00FFu;
  const std::uint32_t g=(((a&0x00FF00u)*iw+(b&0x00FF00u)*uw)>>8)&0x00FF00u;
  return 0xFF000000u|rb|g;
}
inline unsigned luma8(std::uint32_t c){return (((c>>16)&255u)*77u+((c>>8)&255u)*150u+(c&255u)*29u)>>8;}

struct Image { std::vector<std::uint32_t> px; unsigned w{}, h{}; void resize(unsigned W,unsigned H){w=W;h=H;px.resize((std::size_t)W*H);} };

// Scale2x (EPX/AdvMAME2x) e Scale3x (AdvMAME3x): bordas de pixel art sem borrar cores.
inline void scale2x(const std::uint32_t* s,unsigned w,unsigned h,Image& o,RowPool& pool){
  o.resize(w*2u,h*2u);
  pool.run(h,[&](unsigned y0,unsigned y1){
    for(unsigned y=y0;y<y1;++y){
      const std::uint32_t* up=s+(std::size_t)(y?y-1:y)*w;const std::uint32_t* row=s+(std::size_t)y*w;const std::uint32_t* dn=s+(std::size_t)(y+1<h?y+1:y)*w;
      std::uint32_t* d0=o.px.data()+(std::size_t)(2*y)*o.w;std::uint32_t* d1=d0+o.w;
      for(unsigned x=0;x<w;++x){
        const unsigned xl=x?x-1:x,xr=x+1<w?x+1:x;
        const std::uint32_t B=up[x],D=row[xl],E=row[x],F=row[xr],H=dn[x];
        std::uint32_t e0=E,e1=E,e2=E,e3=E;
        if(B!=H&&D!=F){e0=D==B?D:E;e1=B==F?F:E;e2=D==H?D:E;e3=H==F?F:E;}
        d0[2*x]=e0;d0[2*x+1]=e1;d1[2*x]=e2;d1[2*x+1]=e3;
      }
    }
  });
}
inline void scale3x(const std::uint32_t* s,unsigned w,unsigned h,Image& o,RowPool& pool){
  o.resize(w*3u,h*3u);
  pool.run(h,[&](unsigned y0,unsigned y1){
    for(unsigned y=y0;y<y1;++y){
      const std::uint32_t* up=s+(std::size_t)(y?y-1:y)*w;const std::uint32_t* row=s+(std::size_t)y*w;const std::uint32_t* dn=s+(std::size_t)(y+1<h?y+1:y)*w;
      std::uint32_t* d0=o.px.data()+(std::size_t)(3*y)*o.w;std::uint32_t* d1=d0+o.w;std::uint32_t* d2=d1+o.w;
      for(unsigned x=0;x<w;++x){
        const unsigned xl=x?x-1:x,xr=x+1<w?x+1:x;
        const std::uint32_t A=up[xl],B=up[x],C=up[xr],D=row[xl],E=row[x],F=row[xr],G=dn[xl],H=dn[x],I=dn[xr];
        std::uint32_t e[9]={E,E,E,E,E,E,E,E,E};
        if(B!=H&&D!=F){
          e[0]=D==B?D:E;
          e[1]=((D==B&&E!=C)||(B==F&&E!=A))?B:E;
          e[2]=B==F?F:E;
          e[3]=((D==B&&E!=G)||(D==H&&E!=A))?D:E;
          e[5]=((B==F&&E!=I)||(H==F&&E!=C))?F:E;
          e[6]=D==H?D:E;
          e[7]=((D==H&&E!=I)||(H==F&&E!=G))?H:E;
          e[8]=H==F?F:E;
        }
        d0[3*x]=e[0];d0[3*x+1]=e[1];d0[3*x+2]=e[2];
        d1[3*x]=e[3];d1[3*x+1]=e[4];d1[3*x+2]=e[5];
        d2[3*x]=e[6];d2[3*x+1]=e[7];d2[3*x+2]=e[8];
      }
    }
  });
}

// Reamostragem separavel (nearest/bilinear/sharp-bilinear) para um retangulo de destino.
inline void resample(const std::uint32_t* s,unsigned sw,unsigned sh,std::uint32_t* d,unsigned stride,unsigned rw,unsigned rh,
                     const std::vector<Tap>& tx,const std::vector<Tap>& ty,RowPool& pool){
  (void)sh;
  pool.run(rh,[&](unsigned y0,unsigned y1){
    for(unsigned y=y0;y<y1;++y){
      const Tap& v=ty[y];const std::uint32_t* a=s+(std::size_t)v.i0*sw;const std::uint32_t* b=s+(std::size_t)v.i1*sw;
      std::uint32_t* o=d+(std::size_t)y*stride;
      if(!v.w){for(unsigned x=0;x<rw;++x){const Tap& t=tx[x];o[x]=lerp(a[t.i0],a[t.i1],t.w);}}
      else for(unsigned x=0;x<rw;++x){const Tap& t=tx[x];o[x]=lerp(lerp(a[t.i0],a[t.i1],t.w),lerp(b[t.i0],b[t.i1],t.w),v.w);}
    }
  });
}

// FXAA 3.11 (qualidade, 12 passos) sobre a imagem ja ampliada: suaviza as escadas das bordas.
struct FxaaParams { float subpix=0.75f, edgeThreshold=0.125f, edgeThresholdMin=0.0312f; };
inline void fxaa(const Image& in,std::uint32_t* d,unsigned stride,RowPool& pool,std::vector<float>& L,const FxaaParams& P=FxaaParams{}){
  const int W=(int)in.w,H=(int)in.h;
  L.resize((std::size_t)W*H);
  pool.run((unsigned)H,[&](unsigned y0,unsigned y1){for(unsigned y=y0;y<y1;++y)for(int x=0;x<W;++x){const std::uint32_t c=in.px[(std::size_t)y*W+x];
    L[(std::size_t)y*W+x]=(((c>>16)&255u)*0.299f+((c>>8)&255u)*0.587f+(c&255u)*0.114f)*(1.0f/255.0f);}});
  auto l=[&](int x,int y){x=std::clamp(x,0,W-1);y=std::clamp(y,0,H-1);return L[(std::size_t)y*W+x];};
  auto c=[&](int x,int y){x=std::clamp(x,0,W-1);y=std::clamp(y,0,H-1);return in.px[(std::size_t)y*W+x];};
  pool.run((unsigned)H,[&](unsigned y0,unsigned y1){
    for(int y=(int)y0;y<(int)y1;++y){
      std::uint32_t* o=d+(std::size_t)y*stride;
      for(int x=0;x<W;++x){
        {const std::uint32_t cc=c(x,y);if(cc==c(x,y-1)&&cc==c(x,y+1)&&cc==c(x-1,y)&&cc==c(x+1,y)){o[x]=cc;continue;}}
        const float M=l(x,y),N=l(x,y-1),S=l(x,y+1),E=l(x+1,y),Wl=l(x-1,y);
        const float mx=std::max({M,N,S,E,Wl}),mn=std::min({M,N,S,E,Wl}),range=mx-mn;
        if(range<std::max(P.edgeThresholdMin,mx*P.edgeThreshold)){o[x]=c(x,y);continue;}
        const float NW=l(x-1,y-1),NE=l(x+1,y-1),SW=l(x-1,y+1),SE=l(x+1,y+1);
        const float NS=N+S,WE=Wl+E,leftC=NW+SW,downC=SW+SE,rightC=NE+SE,upC=NE+NW;
        const float eh=std::fabs(-2*Wl+leftC)+std::fabs(-2*M+NS)*2+std::fabs(-2*E+rightC);
        const float ev=std::fabs(-2*N+upC)+std::fabs(-2*M+WE)*2+std::fabs(-2*S+downC);
        const bool horz=eh>=ev;
        const float l1=horz?N:Wl,l2=horz?S:E;      // 1 = cima/esquerda, 2 = baixo/direita
        const float g1=l1-M,g2=l2-M;
        const bool steep1=std::fabs(g1)>=std::fabs(g2);
        const float gs=0.25f*std::max(std::fabs(g1),std::fabs(g2));
        float step=steep1?-1.0f:1.0f;
        const float avg=0.5f*((steep1?l1:l2)+M);
        // busca ao longo da borda em passos inteiros: a amostra fica a meio pixel da borda,
        // entao a luma bilinear e a media dos dois pixels (este lado e o vizinho do outro lado).
        const int sx=horz?0:(int)step,sy=horz?(int)step:0,ox=horz?1:0,oy=horz?0:1;
        auto edgeLuma=[&](int px,int py){return 0.5f*(l(px,py)+l(px+sx,py+sy));};
        int p1=-1,p2=1;
        float e1=edgeLuma(x-ox,y-oy)-avg,e2=edgeLuma(x+ox,y+oy)-avg;
        bool r1=std::fabs(e1)>=gs,r2=std::fabs(e2)>=gs;
        static const int Q[]={1,1,2,2,4,8,12};
        for(int i=0;i<7&&!(r1&&r2);++i){
          if(!r1){p1-=Q[i];e1=edgeLuma(x+ox*p1,y+oy*p1)-avg;r1=std::fabs(e1)>=gs;}
          if(!r2){p2+=Q[i];e2=edgeLuma(x+ox*p2,y+oy*p2)-avg;r2=std::fabs(e2)>=gs;}
        }
        const float d1=(float)-p1-0.5f,d2=(float)p2-0.5f;
        const bool dir1=d1<d2;const float dmin=std::min(d1,d2),thick=d1+d2;
        float off=thick>0?(-dmin/thick+0.5f):0.0f;
        const bool centerSmaller=M<avg;
        if(((dir1?e1:e2)<0.0f)==centerSmaller)off=0.0f;
        const float la=(1.0f/12.0f)*(2*(NS+WE)+leftC+rightC);
        const float s1=std::clamp(std::fabs(la-M)/range,0.0f,1.0f),s2=(-2*s1+3)*s1*s1;
        off=std::max(off,s2*s2*P.subpix);
        // desloca 'off' pixels perpendicular a borda, na direcao do gradiente mais forte
        const int nx=horz?x:x+(int)step,ny=horz?y+(int)step:y;
        o[x]=lerp(c(x,y),c(nx,ny),std::clamp((int)std::lround(off*256.0f),0,255));
      }
    }
  });
}

// AMD FidelityFX CAS (contraste adaptativo) - nitidez depois do bilinear.
// Peso por canal vem de uma tabela (min,max) -> w em ponto fixo; areas lisas passam direto.
struct CasLut { std::vector<std::int32_t> w; unsigned pct{~0u}; };
inline void buildCasLut(CasLut& L,unsigned sharpenPct){
  if(L.pct==sharpenPct&&!L.w.empty())return;
  L.pct=sharpenPct;L.w.assign(256u*256u,0);
  const double peak=-1.0/(8.0-3.0*(std::min(sharpenPct,100u)/100.0)); // -1/8 .. -1/5
  for(unsigned mn=0;mn<256;++mn)for(unsigned mx=mn;mx<256;++mx){
    if(!mx)continue;
    const double amp=std::sqrt(std::clamp(std::min<double>(mn,255.0-mx)/mx,0.0,1.0));
    L.w[mn*256u+mx]=(std::int32_t)std::lround(amp*peak*4096.0);
  }
}
inline void cas(const Image& in,std::uint32_t* d,unsigned stride,unsigned sharpenPct,RowPool& pool,CasLut& L){
  buildCasLut(L,sharpenPct);
  const int W=(int)in.w,H=(int)in.h;
  pool.run((unsigned)H,[&](unsigned y0,unsigned y1){
    for(int y=(int)y0;y<(int)y1;++y){
      const std::uint32_t* r=in.px.data()+(std::size_t)y*W;const std::uint32_t* u=in.px.data()+(std::size_t)(y?y-1:y)*W;const std::uint32_t* dn=in.px.data()+(std::size_t)(y+1<H?y+1:y)*W;
      std::uint32_t* o=d+(std::size_t)y*stride;
      for(int x=0;x<W;++x){
        const std::uint32_t c=r[x],n=u[x],s=dn[x],w=r[x?x-1:x],e=r[x+1<W?x+1:x];
        if(c==n&&c==s&&c==w&&c==e){o[x]=c|0xFF000000u;continue;}
        std::uint32_t out=0xFF000000u;
        for(int sh=0;sh<=16;sh+=8){
          const int vc=(c>>sh)&255,v1=(n>>sh)&255,v2=(s>>sh)&255,v3=(w>>sh)&255,v4=(e>>sh)&255;
          const int mn=std::min({vc,v1,v2,v3,v4}),mx=std::max({vc,v1,v2,v3,v4});
          if(mn==mx){out|=(std::uint32_t)vc<<sh;continue;}
          const std::int64_t wt=L.w[(unsigned)mn*256u+(unsigned)mx];
          const std::int64_t num=wt*(v1+v2+v3+v4)+4096*(std::int64_t)vc,den=4096+4*wt;
          out|=(std::uint32_t)std::clamp<std::int64_t>((num+den/2)/den,0,255)<<sh;
        }
        o[x]=out;
      }
    }
  });
}

// CRT: feixe gaussiano por linha (mais largo nas cores claras) + mascara de abertura RGB.
struct CrtLut { std::vector<std::uint16_t> w; std::vector<std::uint32_t> rows; };
inline void buildCrtLut(CrtLut& L){
  if(!L.w.empty())return;
  L.w.resize(65u*256u);
  for(unsigned dq=0;dq<=64;++dq){
    const double dist=dq/64.0; // distancia ao centro da linha, em linhas da origem
    for(unsigned v=0;v<256;++v){
      const double lv=v/255.0,sigma=0.20+0.18*lv;
      const double g=std::exp(-0.5*(dist/sigma)*(dist/sigma));
      L.w[dq*256u+v]=(std::uint16_t)std::lround(v*g*256.0); // valor*peso, 8.8
    }
  }
}
inline void crt(const std::uint32_t* s,unsigned sw,unsigned sh,std::uint32_t* d,unsigned stride,unsigned rw,unsigned rh,
                const std::vector<Tap>& tx,unsigned maskPct,CrtLut& L,RowPool& pool){
  buildCrtLut(L);
  const unsigned dim=std::min(maskPct,100u)*256u/100u;
  // compensacao de brilho da mascara (media de 1 aceso + 2 apagados) e do feixe
  const unsigned boost=(unsigned)std::lround(256.0*1.18*3.0/(1.0+2.0*dim/256.0));
  const bool useMask=rw>=sw*2u;
  // passo horizontal uma vez por linha da origem (cada linha vira ~5 linhas no destino)
  std::vector<std::uint32_t>& hz=L.rows;hz.resize((std::size_t)sh*rw);
  pool.run(sh,[&](unsigned y0,unsigned y1){for(unsigned y=y0;y<y1;++y){const std::uint32_t* a=s+(std::size_t)y*sw;std::uint32_t* o=hz.data()+(std::size_t)y*rw;
    for(unsigned x=0;x<rw;++x){const Tap& t=tx[x];o[x]=lerp(a[t.i0],a[t.i1],t.w);}}});
  pool.run(rh,[&](unsigned y0,unsigned y1){
    for(unsigned y=y0;y<y1;++y){
      const double v=(y+0.5)*double(sh)/double(rh);
      const int r=std::min<int>((int)sh-1,(int)std::floor(v));
      const double dist=v-(r+0.5);
      const int r2=std::clamp(r+(dist>=0?1:-1),0,(int)sh-1);
      const unsigned dq1=(unsigned)std::lround(std::fabs(dist)*64.0),dq2=64u-std::min(64u,dq1);
      const std::uint32_t* a=hz.data()+(std::size_t)r*rw;const std::uint32_t* b=hz.data()+(std::size_t)r2*rw;
      std::uint32_t* o=d+(std::size_t)y*stride;
      for(unsigned x=0;x<rw;++x){
        const std::uint32_t ca=a[x],cb=b[x];
        std::uint32_t out=0xFF000000u;const unsigned phase=x%3u; // fosforos R,G,B
        for(unsigned ch=0;ch<3;++ch){
          const unsigned shft=16u-ch*8u;
          unsigned val=(L.w[dq1*256u+((ca>>shft)&255u)]+L.w[dq2*256u+((cb>>shft)&255u)])>>8;
          if(useMask){val=(val*(phase==ch?256u:dim))>>8;}
          val=(val*boost)>>8;
          out|=std::min(255u,val)<<shft;
        }
        o[x]=out;
      }
    }
  });
}

// LCD: grade escura entre os pixels do SNES (pixel nitido).
inline void lcd(const std::uint32_t* s,unsigned sw,unsigned sh,std::uint32_t* d,unsigned stride,unsigned rw,unsigned rh,RowPool& pool){
  std::vector<std::uint8_t> gx(rw),gy(rh);std::vector<int> ix(rw);
  const bool grid=rw>=sw*3u&&rh>=sh*3u;
  for(unsigned x=0;x<rw;++x){const double u=(x+0.5)*sw/rw;ix[x]=std::min<int>((int)sw-1,(int)u);const double nx=(x+1.5)*sw/rw;gx[x]=grid&&((int)nx!=ix[x]);}
  for(unsigned y=0;y<rh;++y){const double u=(y+0.5)*sh/rh,nu=(y+1.5)*sh/rh;gy[y]=grid&&((int)nu!=(int)u);}
  pool.run(rh,[&](unsigned y0,unsigned y1){
    for(unsigned y=y0;y<y1;++y){
      const int r=std::min<int>((int)sh-1,(int)((y+0.5)*sh/rh));const std::uint32_t* a=s+(std::size_t)r*sw;std::uint32_t* o=d+(std::size_t)y*stride;
      for(unsigned x=0;x<rw;++x){
        std::uint32_t c=a[ix[x]];
        if(gx[x]||gy[y]){const unsigned k=(gx[x]&&gy[y])?150u:190u;c=0xFF000000u|((((c&0xFF00FFu)*k)>>8)&0xFF00FFu)|((((c&0xFF00u)*k)>>8)&0xFF00u);}
        o[x]=c;
      }
    }
  });
}

// ---------------------------------------------------------------- renderizador
class Renderer {
public:
  Renderer():pool(std::make_unique<RowPool>()){}
  explicit Renderer(unsigned threads):pool(std::make_unique<RowPool>(threads)){}
  // Desenha o quadro inteiro (bordas pretas + imagem) com cw x ch pixels.
  void render(const std::uint32_t* fb,unsigned fbW,unsigned fbH,unsigned cw,unsigned ch,const Settings& s){
    if(!cw||!ch||!fb||!fbW||!fbH)return;
    const Rect r=imageRect((int)cw,(int)ch,fbW,fbH,s);
    if(canvasW!=cw||canvasH!=ch||!(r==lastRect)){canvas.assign((std::size_t)cw*ch,0xFF000000u);canvasW=cw;canvasH=ch;lastRect=r;}
    rect=r;
    if(r.w<=0||r.h<=0)return;
    std::uint32_t* dst=canvas.data()+(std::size_t)r.y*cw+r.x;
    renderInto(fb,fbW,fbH,dst,cw,(unsigned)r.w,(unsigned)r.h,s);
  }
  // Renderiza so a imagem (rw x rh) num buffer qualquer.
  void renderInto(const std::uint32_t* fb,unsigned fbW,unsigned fbH,std::uint32_t* dst,unsigned stride,unsigned rw,unsigned rh,const Settings& s){
    const Filter f=s.filter;
    const std::uint32_t* src=fb;unsigned sw=fbW,sh=fbH;
    if(f==Filter::Scale2x){scale2x(fb,fbW,fbH,pre,*pool);src=pre.px.data();sw=pre.w;sh=pre.h;}
    else if(f==Filter::Scale3x||f==Filter::Scale3xFxaa){scale3x(fb,fbW,fbH,pre,*pool);src=pre.px.data();sw=pre.w;sh=pre.h;}
    const TapMode mode=f==Filter::Nearest?TapMode::Nearest:(f==Filter::Bilinear||f==Filter::Cas||f==Filter::Crt)?TapMode::Bilinear:TapMode::Sharp;
    const TapMode modeY=f==Filter::Crt?TapMode::Nearest:mode;
    const std::uint64_t key=((std::uint64_t)sw<<48)^((std::uint64_t)sh<<32)^((std::uint64_t)rw<<16)^rh^((std::uint64_t)unsigned(mode)<<62)^((std::uint64_t)unsigned(modeY)<<60);
    if(key!=tapKey){buildTaps(tx,sw,rw,mode);buildTaps(ty,sh,rh,modeY);tapKey=key;}
    switch(f){
      case Filter::Crt: crt(src,sw,sh,dst,stride,rw,rh,tx,s.crtMask,crtLut,*pool);break;
      case Filter::Lcd: lcd(src,sw,sh,dst,stride,rw,rh,*pool);break;
      case Filter::Fxaa: case Filter::Scale3xFxaa:{
        // FXAA numa ampliacao inteira (2x-4x), depois sharp-bilinear ate o destino: mesma suavizacao
        // das escadas com 3-9x menos pixels que o FXAA na resolucao final.
        unsigned kmax=2u;if(const char* e=std::getenv("FORJA65_VIDEO_FXAA_SCALE"))if(*e)kmax=std::clamp((unsigned)std::strtoul(e,nullptr,10),1u,4u);
        unsigned k=f==Filter::Scale3xFxaa?1u:std::clamp(std::min(rw/std::max(1u,sw),rh/std::max(1u,sh)),1u,kmax);
        if(k>1){mid.resize(sw*k,sh*k);std::vector<Tap> kx,ky;buildTaps(kx,sw,sw*k,TapMode::Nearest);buildTaps(ky,sh,sh*k,TapMode::Nearest);
          resample(src,sw,sh,mid.px.data(),mid.w,mid.w,mid.h,kx,ky,*pool);}
        else{mid.resize(sw,sh);std::copy(src,src+(std::size_t)sw*sh,mid.px.begin());}
        aa.resize(mid.w,mid.h);fxaa(mid,aa.px.data(),aa.w,*pool,luma);
        if(aa.w==rw&&aa.h==rh){for(unsigned y=0;y<rh;++y)std::copy_n(aa.px.data()+(std::size_t)y*rw,rw,dst+(std::size_t)y*stride);break;}
        const std::uint64_t k2=((std::uint64_t)aa.w<<48)^((std::uint64_t)aa.h<<32)^((std::uint64_t)rw<<16)^rh;
        if(k2!=aaKey){buildTaps(ax,aa.w,rw,TapMode::Sharp);buildTaps(ay,aa.h,rh,TapMode::Sharp);aaKey=k2;}
        resample(aa.px.data(),aa.w,aa.h,dst,stride,rw,rh,ax,ay,*pool);break;}
      case Filter::Cas:{
        // bilinear ate 2x-3x, CAS, depois sharp-bilinear ate o destino
        const unsigned k=std::clamp(std::min(rw/std::max(1u,sw),rh/std::max(1u,sh)),1u,3u);
        mid.resize(sw*k,sh*k);{std::vector<Tap> kx,ky;buildTaps(kx,sw,mid.w,TapMode::Bilinear);buildTaps(ky,sh,mid.h,TapMode::Bilinear);
          resample(src,sw,sh,mid.px.data(),mid.w,mid.w,mid.h,kx,ky,*pool);}
        aa.resize(mid.w,mid.h);cas(mid,aa.px.data(),aa.w,s.sharpen,*pool,casLut);
        const std::uint64_t k2=((std::uint64_t)aa.w<<48)^((std::uint64_t)aa.h<<32)^((std::uint64_t)rw<<16)^rh^(1ull<<63);
        if(k2!=aaKey){buildTaps(ax,aa.w,rw,TapMode::Bilinear);buildTaps(ay,aa.h,rh,TapMode::Bilinear);aaKey=k2;}
        resample(aa.px.data(),aa.w,aa.h,dst,stride,rw,rh,ax,ay,*pool);break;}
      default: resample(src,sw,sh,dst,stride,rw,rh,tx,ty,*pool);break;
    }
  }
  const std::vector<std::uint32_t>& frame()const{return canvas;}
  unsigned width()const{return canvasW;}
  unsigned height()const{return canvasH;}
  Rect rect{};
  unsigned threads()const{return pool->threads();}
private:
  std::unique_ptr<RowPool> pool;
  std::vector<std::uint32_t> canvas;unsigned canvasW{},canvasH{};Rect lastRect{};
  Image pre,mid,aa;std::vector<Tap> ax,ay;std::uint64_t aaKey{~0ull};CasLut casLut;std::vector<float> luma;std::vector<Tap> tx,ty;std::uint64_t tapKey{~0ull};CrtLut crtLut;
};

inline bool writeBmp(const std::string& path,const std::uint32_t* px,unsigned w,unsigned h,unsigned stride){
  std::ofstream o(path,std::ios::binary|std::ios::trunc);if(!o)return false;
  const unsigned row=w*3u,pad=(4u-row%4u)%4u,size=54u+(row+pad)*h;
  auto u16=[&](unsigned v){char b[2]={char(v&255),char((v>>8)&255)};o.write(b,2);};
  auto u32=[&](unsigned v){char b[4]={char(v&255),char((v>>8)&255),char((v>>16)&255),char((v>>24)&255)};o.write(b,4);};
  o.write("BM",2);u32(size);u32(0);u32(54);u32(40);u32(w);u32(h);u16(1);u16(24);u32(0);u32(size-54u);u32(2835);u32(2835);u32(0);u32(0);
  std::vector<char> line(row+pad,0);
  for(unsigned y=h;y-->0;){const std::uint32_t* p=px+(std::size_t)y*stride;for(unsigned x=0;x<w;++x){line[3*x]=char(p[x]&255u);line[3*x+1]=char((p[x]>>8)&255u);line[3*x+2]=char((p[x]>>16)&255u);}o.write(line.data(),(std::streamsize)line.size());}
  return bool(o);
}

#ifdef _WIN32
// ---------------------------------------------------------------- janela Windows (GDI)
class WinHost {
public:
  Settings s;
  bool attached{};
  void attach(HWND h){
    hwnd=h;s=loadSettings();attached=true;
    {std::ifstream probe("forja65-video.ini");if(!probe)saveSettings(loadSettings("forja65-video.ini",false));} // cria o .ini (padroes, sem as variaveis de ambiente)
    if(s.legacy)return;
    applyWindowSize();
    if(s.fullscreen){s.fullscreen=false;setFullscreen(true);}
    updateTitle();
  }
  // Teclas do video. Retorna true se a mensagem foi consumida (nao repassar a DispatchMessage).
  bool handleMessage(const MSG& m){
    if(!attached||s.legacy||m.hwnd!=hwnd)return false;
    const bool down=m.message==WM_KEYDOWN||m.message==WM_SYSKEYDOWN,up=m.message==WM_KEYUP||m.message==WM_SYSKEYUP;
    if(!down&&!up)return false;
    const WPARAM k=m.wParam;const bool alt=(m.lParam&(1<<29))!=0;
    const bool mine=k==VK_F7||k==VK_F8||k==VK_F10||k==VK_F11||k==VK_F12||(k==VK_RETURN&&alt)||(k==VK_ESCAPE&&s.fullscreen);
    if(!mine)return false;
    if(up)return true;
    if(m.lParam&(1<<30))return true; // auto-repeticao
    const bool shift=(GetKeyState(VK_SHIFT)&0x8000)!=0;
    const unsigned nf=unsigned(Filter::Count),nr=(unsigned)resolutions().size(),na=unsigned(Aspect::Count);
    if(k==VK_F7)s.filter=Filter((unsigned(s.filter)+(shift?nf-1u:1u))%nf);
    else if(k==VK_F8){s.customW=s.customH=0;s.resIndex=(s.resIndex+(shift?nr-1u:1u))%nr;applyWindowSize();}
    else if(k==VK_F10)s.aspect=Aspect((unsigned(s.aspect)+(shift?na-1u:1u))%na);
    else if(k==VK_F11||k==VK_RETURN)setFullscreen(!s.fullscreen);
    else if(k==VK_ESCAPE)setFullscreen(false);
    else if(k==VK_F12){screenshot();return true;}
    saveSettings(s);updateTitle();
    return true;
  }
  void present(const std::uint32_t* fb,unsigned fbW,unsigned fbH){
    RECT rc{};GetClientRect(hwnd,&rc);
    const unsigned cw=(unsigned)std::max<LONG>(1,rc.right-rc.left),ch=(unsigned)std::max<LONG>(1,rc.bottom-rc.top);
    r.render(fb,fbW,fbH,cw,ch,s);
    BITMAPINFO bi{};bi.bmiHeader.biSize=sizeof(BITMAPINFOHEADER);bi.bmiHeader.biWidth=(LONG)cw;bi.bmiHeader.biHeight=-(LONG)ch;
    bi.bmiHeader.biPlanes=1;bi.bmiHeader.biBitCount=32;bi.bmiHeader.biCompression=BI_RGB;
    HDC dc=GetDC(hwnd);
    SetDIBitsToDevice(dc,0,0,cw,ch,0,0,0,ch,r.frame().data(),&bi,DIB_RGB_COLORS);
    ReleaseDC(hwnd,dc);
    if(fbW!=lastW||fbH!=lastH){lastW=fbW;lastH=fbH;updateTitle();}
  }
private:
  HWND hwnd{};Renderer r;WINDOWPLACEMENT prev{};LONG_PTR prevStyle{};unsigned lastW{256},lastH{224},shots{};
  void applyWindowSize(){
    if(!hwnd||s.fullscreen)return;
    RECT wa{};SystemParametersInfoW(SPI_GETWORKAREA,0,&wa,0);
    RECT fr{0,0,0,0};AdjustWindowRect(&fr,WS_OVERLAPPEDWINDOW,FALSE);
    const unsigned availW=(unsigned)std::max<LONG>(320,(wa.right-wa.left)-(fr.right-fr.left));
    const unsigned availH=(unsigned)std::max<LONG>(240,(wa.bottom-wa.top)-(fr.bottom-fr.top));
    const Resolution c=windowClientFor(s,availW,availH);
    RECT w{0,0,(LONG)c.w,(LONG)c.h};AdjustWindowRect(&w,WS_OVERLAPPEDWINDOW,FALSE);
    if(IsZoomed(hwnd))ShowWindow(hwnd,SW_RESTORE);
    SetWindowPos(hwnd,nullptr,0,0,w.right-w.left,w.bottom-w.top,SWP_NOMOVE|SWP_NOZORDER|SWP_NOACTIVATE);
  }
  void setFullscreen(bool on){
    if(on==s.fullscreen)return;
    if(on){
      prev.length=sizeof(prev);GetWindowPlacement(hwnd,&prev);prevStyle=GetWindowLongPtrW(hwnd,GWL_STYLE);
      MONITORINFO mi{};mi.cbSize=sizeof(mi);GetMonitorInfoW(MonitorFromWindow(hwnd,MONITOR_DEFAULTTONEAREST),&mi);
      SetWindowLongPtrW(hwnd,GWL_STYLE,(prevStyle&~(LONG_PTR)WS_OVERLAPPEDWINDOW)|WS_POPUP|WS_VISIBLE);
      SetWindowPos(hwnd,HWND_TOP,mi.rcMonitor.left,mi.rcMonitor.top,mi.rcMonitor.right-mi.rcMonitor.left,mi.rcMonitor.bottom-mi.rcMonitor.top,SWP_FRAMECHANGED|SWP_NOOWNERZORDER);
      s.fullscreen=true;
    }else{
      SetWindowLongPtrW(hwnd,GWL_STYLE,prevStyle?prevStyle:(LONG_PTR)(WS_OVERLAPPEDWINDOW|WS_VISIBLE));
      if(prev.length)SetWindowPlacement(hwnd,&prev);
      SetWindowPos(hwnd,nullptr,0,0,0,0,SWP_NOMOVE|SWP_NOSIZE|SWP_NOZORDER|SWP_NOOWNERZORDER|SWP_FRAMECHANGED);
      s.fullscreen=false;applyWindowSize();
    }
  }
  void screenshot(){
    char name[64];std::snprintf(name,sizeof(name),"forja65-shot-%03u.bmp",++shots);
    const Rect& q=r.rect;if(q.w<=0||q.h<=0)return;
    writeBmp(name,r.frame().data()+(std::size_t)q.y*r.width()+q.x,(unsigned)q.w,(unsigned)q.h,r.width());
  }
  void updateTitle(){
    if(!hwnd)return;
    const std::string t="Forja65 Native Port - "+std::string(filterLabel(s.filter))+" | "+resolutionText(s)+" | "+aspectKey(s.aspect)+
      " | F7 filtro  F8 resolucao  F10 aspecto  F11 tela cheia  F12 captura";
    SetWindowTextA(hwnd,t.c_str());
  }
};
#endif

} // namespace forja65video
