#include "forja_checkpoint.hpp"
#include <cmath>
#include <cstdio>
#include <memory>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
// Independent clock-by-clock adapter of ares mosaic.cpp/io.cpp/mode7.cpp,
// commit 9408cb43d4948fc3ea6e152a307a34348df3fe04. ISC notice in docs/mode7-rev162/upstream.
// The oracle advances one pixel at a time; production must handle batched segments.
struct Oracle{
 unsigned size=1,mask=0,vertical=0,hleft[2]{1,1},hx[2]{},x=0,row=0; bool extbg=true;
 void write(unsigned v){bool was=mask!=0;size=v/16+1;mask=v%16;if(!was&&mask)vertical=size+1;}
 void line(unsigned r,unsigned hardwareV){row=r;x=0;hx[0]=hx[1]=0;hleft[0]=hleft[1]=size;
  if(hardwareV==1)vertical=mask?size+1:0;
  if(vertical){--vertical;if(!vertical&&mask)vertical=size;}
 }
 void pixel(){for(unsigned bg=0;bg<2;bg++){if(bg==1&&!extbg){if(x==0)hleft[bg]=size;else if(!--hleft[bg])hleft[bg]=size;}else if(mask&(1u<<bg)){if(!--hleft[bg]){hleft[bg]=size;hx[bg]+=size;}}else ++hx[bg];}++x;}
 int y()const{return int(row)-((mask&1u)?int(size)-int(vertical):0);}
};
static unsigned staticChecks{},liveChecks{},checkpointChecks{},staticFail{},liveFail{},checkpointFail{};
static void scene(PpuState&p){
 p.bgmode=7;p.brightness=15;p.tm=1;p.setini=0x40;p.m7[0]=p.m7[3]=256;p.bgFirstLineHidden=true;
 for(unsigned y=0;y<128;y++)for(unsigned x=0;x<128;x++)p.vram[(y*128+x)*2]=(x*17+y*31)&255u;
 for(unsigned t=0;t<256;t++)for(unsigned y=0;y<8;y++)for(unsigned x=0;x<8;x++)p.vram[(t*64+y*8+x)*2+1]=(t*53+x*7+y*29)%255+1;
 for(unsigned i=0;i<256;i++){p.cgram[i*2]=i;p.cgram[i*2+1]=0;}
}
// Independent mathematical affine oracle (floating floor, no production helpers).
static int s13(unsigned v){v%=8192u;return v>=4096u?int(v)-8192:int(v);}
static int s16(unsigned v){return v>=32768u?int(v)-65536:int(v);}
static unsigned expected(const PpuState&p,unsigned bg,int x,int y){
 y+=p.bgFirstLineHidden?1:0;if(p.m7sel&1u)x=255-x;if(p.m7sel&2u)y=255-y;
 auto clip=[](int v){int r=v%1024;if(r<0)r+=1024;return v<0?r-1024:r;};
 auto drop=[](double q){return std::floor(q/64.0)*64.0;};
 int a=s16(p.m7[0]),b=s16(p.m7[1]),c=s16(p.m7[2]),d=s16(p.m7[3]);
 int cx=s13(p.m7[4]),cy=s13(p.m7[5]),h=clip(s13(p.m7Hofs)-cx),v=clip(s13(p.m7Vofs)-cy);
 int tx=int(std::floor((drop(double(a)*h)+drop(double(b)*v)+drop(double(b)*y)+double(cx)*256+double(a)*x)/256));
 int ty=int(std::floor((drop(double(c)*h)+drop(double(d)*v)+drop(double(d)*y)+double(cy)*256+double(c)*x)/256));
 bool outside=tx<0||ty<0||tx>=1024||ty>=1024;
 if(outside&&(p.m7sel&0xc0u)==0x80u)return 0;
 unsigned ux=unsigned(tx)&1023u,uy=unsigned(ty)&1023u;
 unsigned tile=((ux/8)*17+(uy/8)*31)&255u;
 if(outside&&(p.m7sel&0xc0u)==0xc0u)tile=0;
 unsigned ci=(tile*53+(ux%8)*7+(uy%8)*29)%255+1;
 if(bg)return ci%128;
 if(p.cgwsel&1u)return ((ci&7u)<<2)|((ci&0x38u)<<4)|((ci&0xc0u)<<7);
 return ci;
}
static unsigned rgba(unsigned c){return 0xff000000u|(((c&31u)*255u/31u)<<16)|((((c>>5)&31u)*255u/31u)<<8)|(((c>>10)&31u)*255u/31u);}
static void staticCorpus(){
 for(unsigned size=1;size<=16;size++)for(unsigned mask=0;mask<4;mask++)for(unsigned flip=0;flip<4;flip++){
  PpuState p;scene(p);p.m7sel=flip;p.mosaic=(size-1)*16+mask;
  for(unsigned y=0;y<24;y++)for(unsigned x=0;x<256;x++)for(unsigned bg=0;bg<2;bg++){
   int sx=(mask&(1u<<bg))?int(x-x%size):int(x),sy=(mask&1u)?int(y-y%size):int(y);
   unsigned want=expected(p,bg,sx,sy);auto got=p.sampleMode7(bg,x,y);++staticChecks;
   if(got.valid!=(want!=0)||(want&&got.c15!=want))++staticFail;
  }
 }
}
static unsigned lcg=162;
static unsigned randomWord(){lcg=lcg*1664525u+1013904223u;return lcg;}
static void transformedCorpus(){
 PpuState p;scene(p);
 for(unsigned n=0;n<4096;n++){
  for(auto&v:p.m7)v=(std::uint16_t)randomWord();
  p.m7Hofs=(std::uint16_t)randomWord();p.m7Vofs=(std::uint16_t)randomWord();
  p.m7sel=(std::uint8_t)(randomWord()>>24);p.cgwsel=(randomWord()>>24)&1u;
  p.mosaic=(std::uint8_t)(randomWord()>>24);
  unsigned size=p.mosaic/16+1,mask=p.mosaic%16;
  for(unsigned k=0;k<16;k++){
   unsigned x=(randomWord()>>24),y=(randomWord()>>24)%224;
   for(unsigned bg=0;bg<2;bg++){
    int sx=(mask&(1u<<bg))?int(x-x%size):int(x),sy=(mask&1u)?int(y-y%size):int(y);
    unsigned want=expected(p,bg,sx,sy);auto got=p.sampleMode7(bg,x,y);++staticChecks;
    if(got.valid!=(want!=0)||(want&&got.c15!=want))++staticFail;
   }
  }
 }
}
static void liveCorpus(){
 for(unsigned region:{1u,2u})for(unsigned layer=0;layer<2;layer++)for(unsigned initial:{1u,2u,7u,16u}){
  auto hw=std::make_unique<SnesRuntime>();hw->headless=true;hw->regionCode=region;scene(hw->ppu);hw->ppu.tm=1u<<layer;
  unsigned init=(initial-1)*16+3;hw->ppuPortWrite(0x2106,(std::uint8_t)init);Oracle ref;ref.write(init);hw->beginFrame();ref.line(0,1);
  unsigned lines=hw->frameLineCount()*2u+3u,visited=0;
  while(visited<lines){
   const unsigned line=hw->currentScanline;const bool visible=line<hw->visibleLines();
   // Changes while enabled, all-off -> on, BG1 off while BG2 remains on,
   // and changing size while an older countdown is still pending.
   unsigned events[3]={randomWord()%256u,randomWord()%256u,randomWord()%256u};
   if(visited%5==0)events[0]=0;
   if(visited%5==1)events[0]=0xf2;
   if(visited%5==2)events[1]=0x11;
   const unsigned at[3]={0,37,129};unsigned e=0;bool blank=false;
   std::vector<unsigned> want(256);
   auto consume=[&](unsigned end){while(ref.x<end){unsigned c=expected(hw->ppu,layer,int(ref.hx[layer]),ref.y());want[ref.x]=blank?0xff000000u:rgba(c);ref.pixel();}};
   while(hw->currentScanline==line && visited<lines){
    if(visible){
     unsigned x=hw->rasterLogicalXFromMasterCycle(hw->currentMasterCycle);
     while(e<3&&x>=at[e]){consume(x);hw->ppuPortWrite(0x2106,(std::uint8_t)events[e]);ref.write(events[e]);e++;}
     if(e==3&&x>=173&&x<175&&visited%7==0&&!blank){consume(x);hw->ppuPortWrite(0x2100,0x8f);blank=true;}
    }
    hw->advanceCpuMasterCycles(2);
   }
   if(visible){consume(256);
    for(unsigned x=0;x<256;x++){++liveChecks;if(hw->framebuffer[line*256u+x]!=want[x]){++liveFail;if(liveFail<4)std::printf("LIVE_DIFF region=%u layer=%u line=%u x=%u got=%08x expected=%08x\n",region,layer,line,x,hw->framebuffer[line*256u+x],want[x]);}}
   }
   if(blank)hw->ppuPortWrite(0x2100,15);
   ++visited;ref.line(hw->currentScanline,(hw->currentScanline+1u)%hw->frameLineCount());
   // A mid-row checkpoint must retain both phases, not just MOSAIC ($2106).
   if(visited==19){
    auto a=std::make_unique<SnesRuntime>(),b=std::make_unique<SnesRuntime>();a->headless=b->headless=true;CpuState c;
    forja_checkpoint::decode(forja_checkpoint::encode(c,*hw),c,*a);
    for(unsigned n=0;n<203;n++)a->advanceCpuMasterCycles(2);
    a->ppuPortWrite(0x2106,0x31);
    auto payload=forja_checkpoint::encode(c,*a);forja_checkpoint::decode(payload,c,*b);
    for(unsigned n=0;n<2400;n++){a->advanceCpuMasterCycles(2);b->advanceCpuMasterCycles(2);}
    ++checkpointChecks;if(forja_checkpoint::encode(c,*a)!=forja_checkpoint::encode(c,*b))++checkpointFail;
   }
  }
 }
}
static void prelineCorpus(){
 const char*v0=std::getenv("FORJA65_HDMA_V0_TRANSFER");bool preline=!v0||std::string(v0)!="0";
 for(unsigned size:{2u,7u,16u})for(unsigned mask:{1u,2u,3u})for(bool native:{false,true})for(unsigned layer=0;layer<2;layer++){
  auto hw=std::make_unique<SnesRuntime>();hw->headless=true;hw->nativeDmaEnabled=native;scene(hw->ppu);hw->ppu.tm=1u<<layer;
  unsigned value=(size-1)*16+mask;auto&d=hw->dma[0];d.dmap=0;d.bbad=6;d.a1b=0x7e;d.a1t=0x100;
  hw->ram[0x100]=0x81;hw->ram[0x101]=(std::uint8_t)value;hw->ram[0x102]=0;hw->io.hdmaen=1;
  hw->beginFrame();while(hw->currentScanline==0)hw->advanceCpuMasterCycles(2);
  Oracle ref;if(preline)ref.write(value);ref.line(0,1);
  for(unsigned x=0;x<256;x++){
   unsigned want=rgba(expected(hw->ppu,layer,int(ref.hx[layer]),ref.y()));ref.pixel();++liveChecks;
   if(hw->framebuffer[x]!=want){++liveFail;if(liveFail<4)std::printf("PRELINE_DIFF size=%u mask=%u layer=%u x=%u\n",size,mask,layer,x);}
  }
 }
}
#if defined(FORJA65_TEST_MOSAIC_PHASE_STATE)
static void extbgCorpus(){
 // BG2 is inactive without EXTBG: only its counter advances, never its offset.
 // Include size writes at pixel 0 and off/on/off/on transitions after Mode7 runs.
 for(unsigned size=1;size<=16;size++)for(unsigned mask=0;mask<4;mask++)for(unsigned enableAt:{0u,1u,37u,129u}){
  PpuState p;scene(p);p.setini=0;Oracle ref;ref.extbg=false;
  unsigned initial=(size-1)*16+mask;p.write(0x2106,initial);ref.write(initial);
  p.beginMosaicLine(0,1);ref.line(0,1);
  for(unsigned x=0;x<256;x++){
   p.advanceMosaicTo(x);
   if(x==0){unsigned value=((size+4)%16)*16+mask;p.write(0x2106,value);ref.write(value);}
   if(x==enableAt||x==173||x==211){ref.extbg=x!=173;p.write(0x2133,ref.extbg?0x40:0);}
   if(ref.extbg){auto got=p.sampleMode7(1,x,0);unsigned want=expected(p,1,int(ref.hx[1]),ref.y());++liveChecks;
    if(got.valid!=(want!=0)||(want&&got.c15!=want)){++liveFail;if(liveFail<4)std::printf("EXTBG_DIFF size=%u mask=%u enable=%u x=%u\n",size,mask,enableAt,x);}}
   ref.pixel();p.advanceMosaicTo(x+1);
   ++liveChecks;if(p.mosaicHOffset[1]!=ref.hx[1]||p.mosaicHRemaining[1]!=ref.hleft[1])++liveFail;
  }
 }
}
#else
static void extbgCorpus(){} // REV161 baseline has no phase state to inspect.
#endif
int main(int argc,char**argv){if(argc>1){if(std::string(argv[1])=="--extbg-only")extbgCorpus();else prelineCorpus();}else{staticCorpus();transformedCorpus();liveCorpus();prelineCorpus();extbgCorpus();}
 std::printf("MODE7_MOSAIC_REV162 static=%u static_fail=%u live=%u live_fail=%u checkpoint=%u checkpoint_fail=%u\n",staticChecks,staticFail,liveChecks,liveFail,checkpointChecks,checkpointFail);
 return staticFail||liveFail||checkpointFail?1:0;
}
