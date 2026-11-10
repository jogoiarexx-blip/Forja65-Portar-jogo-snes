#include "runtime.hpp"
#include <cstdio>
#include <memory>
// Stable-register adapter of pinned ares/bsnes Background fetch/run rules.
// The reference advances mosaic once per LOGICAL dot, with two hires phases.
struct Expected{unsigned color{},priority{};bool valid{};};
static Expected reference(const PpuState&p,unsigned bg,unsigned screenX,unsigned screenY,unsigned bpp){
 unsigned h=screenX+2u*p.scrollX[bg],v=screenY+p.scrollY[bg];
 unsigned ht=h/16,vt=v/(((p.bgmode>>(4+bg))&1u)?16u:8u),sc=p.bgsc[bg]&3u;
 unsigned entry=(vt%32)*32+ht%32;
 if((sc&1u)&&(ht&32u))entry+=1024;
 if((sc&2u)&&(vt&32u))entry+=(sc&1u)?2048:1024;
 unsigned a=(((p.bgsc[bg]&252u)<<9)+entry*2)&65535u,attr=p.vram[a]|(p.vram[(a+1)&65535u]<<8),tile=attr&1023u;
 bool hf=attr&0x4000u,vf=attr&0x8000u;
 if(bool(h&8u)!=hf)++tile;
 if(((p.bgmode>>(4+bg))&1u)&&bool(v&8u)!=vf)tile+=16;
 unsigned px=(h%8)^(hf?7u:0u),py=(v%8)^(vf?7u:0u),ci=0;
 for(unsigned plane=0;plane<bpp;plane++){
  unsigned address=(((p.bgnba[bg]&7u)<<13)+(tile&1023u)*bpp*8+py*2+(plane/2)*16+(plane%2))&65535u;
  ci|=((p.vram[address]>>(7-px))&1u)<<plane;
 }
 unsigned index=((attr>>10)&7u)*(1u<<bpp)+ci;
 return{unsigned(p.cgram[index*2]|((p.cgram[index*2+1]&127u)<<8)),(attr&0x2000u)?(bg?11u:15u):(bg?3u:7u),ci!=0};
}
static unsigned seed=0x16565816u;
static unsigned next(){seed=seed*1664525u+1013904223u;return seed;}
static unsigned rgba(unsigned c){return 0xff000000u|(((c&31)*255/31)<<16)|((((c>>5)&31)*255/31)<<8)|(((c>>10)&31)*255/31);}
static bool differs(const PpuState::LayerPixel&got,const Expected&want){return got.valid!=want.valid||(want.valid&&(got.c15!=want.color||got.priority!=want.priority));}
static unsigned verticalAnchor(unsigned y,unsigned period){unsigned anchor=0,left=period;for(unsigned row=1;row<=y;row++)if(!--left){anchor=row;left=period;}return anchor;}
static void scene(PpuState&p,unsigned mode,unsigned bg,unsigned big,unsigned sc,unsigned flip){
 p.bgmode=mode|(big<<(4+bg));p.brightness=15;p.tm=p.ts=1u<<bg;p.bgsc[bg]=0x60u|sc;p.bgnba[bg]=0;p.bgFirstLineHidden=true;
 for(auto&v:p.vram)v=next()>>24;
 p.bgsc[2]=0x50;std::fill(p.vram.begin()+0xa000,p.vram.begin()+0xa800,0); // OPT disabled to isolate mosaic.
 for(unsigned i=0;i<256;i++){p.cgram[i*2]=i;p.cgram[i*2+1]=i>>3;}
 for(unsigned i=0;i<4096;i++){unsigned attr=next()%700u|((next()&7u)<<10)|(flip<<14)|((next()&1u)<<13),a=0xc000u+i*2;p.vram[a]=attr;p.vram[a+1]=attr>>8;}
 p.scrollX[bg]=(sc*257+flip*7+big*3)&1023u;p.scrollY[bg]=sc*239+flip*13;
}
static unsigned mosaicChecks{},mosaicFail{},controlChecks{},controlFail{},cacheChecks{},cacheFail{},outputChecks{},outputFail{},transferChecks{},transferFail{};
static void corpus(){
 std::vector<std::uint32_t>fb;
 for(unsigned mode:{5u,6u})for(unsigned bg=0;bg<(mode==5?2u:1u);bg++)for(unsigned big=0;big<2;big++)for(unsigned sc:{0u,3u})for(unsigned flip:{0u,3u}){
  PpuState p;scene(p,mode,bg,big,sc,flip);unsigned bpp=bg?2u:4u;
  for(unsigned period=1;period<=16;period++)for(bool enabled:{false,true})for(bool interlace:{false,true})for(unsigned field=0;field<2;field++)for(unsigned y:{0u,7u,223u}){
   p.mosaic=(period-1)*16+(enabled?(1u<<bg):0u);p.setini=interlace?1u:0u;unsigned physicalY=interlace?y*2+field:y;
   unsigned refY=(enabled?verticalAnchor(y,period):y)+1;refY=interlace?refY*2+(enabled?0u:field):refY;
   unsigned anchor=0,left=period;PpuState::BgTileCache cache{};
   p.renderOutputSegment(fb,y,0,73,field);p.renderOutputSegment(fb,y,73,257,field);p.renderOutputSegment(fb,y,257,512,field);
   for(unsigned x=0;x<512;x++){
    if(x&&x%2==0&&!--left){anchor=x;left=period;}
    const auto want=reference(p,bg,enabled?anchor:x,refY,bpp); const auto got=p.sampleBg(bg,x,physicalY,bpp,0,true); const auto cached=p.sampleBg(bg,x,physicalY,bpp,0,true,false,&cache);
    if(enabled){++mosaicChecks;mosaicFail+=differs(got,want);}else{++controlChecks;controlFail+=differs(got,want);}
    ++cacheChecks;cacheFail+=cached.valid!=got.valid||(got.valid&&(cached.c15!=got.c15||cached.priority!=got.priority));
    // Both screens enable the same BG and math/clip are disabled. Skip the
    // separately known first-hires-pixel/DAC-delay issue, outside this change.
    if(x>=2){unsigned row=interlace?y*2+field:y;unsigned c=want.valid?want.color:unsigned(p.cgram[0]|((p.cgram[1]&127u)<<8));++outputChecks;outputFail+=fb[row*512+x]!=rgba(c);}
   }
  }
 }
}
static void transports(){
 for(bool native:{false,true})for(bool stateOnly:{false,true})for(unsigned method=0;method<3;method++)for(unsigned mode:{5u,6u})for(unsigned bg=0;bg<(mode==5?2u:1u);bg++){
  auto ptr=std::make_unique<SnesRuntime>();auto&h=*ptr;h.headless=true;h.nativeDmaEnabled=native;h.ppuMode=stateOnly?PpuRuntimeMode::StateOnlyNativeScanout:PpuRuntimeMode::VirtualRegisters;
  scene(h.ppu,mode,bg,0,0,0);h.ppu.forceBlank=true;h.ppu.setini=1;h.beginFrame();h.currentScanline=225;h.currentMasterCycle=100;
  for(unsigned period=1;period<=16;period++){
   unsigned value=(period-1)*16+(1u<<bg);
   if(method==0)h.write8(0x2106,value);else{auto&d=h.dma[0];d.dmap=0;d.bbad=6;d.a1b=0x7e;h.ram[0x100]=value;if(method==1){d.a1t=0x100;d.das=1;h.executeDma(1);}else{d.a2a=0x100;h.hdmaActive=1;h.hdmaLines[0]=1;h.hdmaTransfer[0]=true;h.executeHdmaLine();}}
   bool fail=h.ppu.mosaic!=value;
   for(unsigned field=0;field<2;field++)for(unsigned x:{1u,2u,15u,16u,31u,73u}){
    unsigned logical=x/2,anchor=0,left=period;for(unsigned dot=1;dot<=logical;dot++)if(!--left){anchor=dot*2;left=period;}
    const auto want=reference(h.ppu,bg,anchor,(verticalAnchor(15,period)+1)*2,bg?2u:4u); const auto got=h.ppu.sampleBg(bg,x,30+field,bg?2u:4u,0,true);fail|=differs(got,want);
   }
   ++transferChecks;transferFail+=fail;
  }
 }
}
int main(){corpus();transports();std::printf("HIRES_MOSAIC_REV165 mosaic=%u mosaic_fail=%u controls=%u control_fail=%u cache=%u cache_fail=%u output=%u output_fail=%u transfers=%u transfer_fail=%u\n",mosaicChecks,mosaicFail,controlChecks,controlFail,cacheChecks,cacheFail,outputChecks,outputFail,transferChecks,transferFail);return mosaicFail||controlFail||cacheFail||outputFail||transferFail?1:0;}
