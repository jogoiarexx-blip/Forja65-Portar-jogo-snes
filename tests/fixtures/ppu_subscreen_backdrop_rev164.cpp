#include "forja_checkpoint.hpp"
#include <cstdio>
#include <memory>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
static unsigned rawChecks{},rawFail{},outputChecks{},outputFail{},mathChecks{},mathFail{},transferChecks{},transferFail{};
static unsigned seed=0x16465816;
static unsigned randomColor(){seed=seed*1664525u+1013904223u;return(seed>>8)&32767u;}
static void palette(PpuState&p,unsigned index,unsigned c){p.write(0x2121,index);p.write(0x2122,c&255u);p.write(0x2122,c>>8);}
static void fixed(PpuState&p,unsigned c){p.write(0x2132,0x20u|(c&31));p.write(0x2132,0x40u|((c>>5)&31));p.write(0x2132,0x80u|((c>>10)&31));}
// Independent channel arithmetic and RGB conversion. No production color helper.
static unsigned blend(unsigned a,unsigned b,bool subtract,bool halve){unsigned out=0;for(unsigned shift:{0u,5u,10u}){int v=subtract?int((a>>shift)&31)-int((b>>shift)&31):int((a>>shift)&31)+int((b>>shift)&31);if(v<0)v=0;if(halve)v/=2;if(v>31)v=31;out|=unsigned(v)<<shift;}return out;}
static unsigned rgba(unsigned c){return 0xff000000u|(((c&31)*255/31)<<16)|((((c>>5)&31)*255/31)<<8)|(((c>>10)&31)*255/31);}
static bool region(unsigned mode,bool inside){const bool result[4]={false,!inside,inside,true};return result[mode];}
static void rawBackdrop(){PpuState p;p.brightness=15;
 for(unsigned n=0;n<256;n++){unsigned c=randomColor();palette(p,0,c);fixed(p,c^32767u);
  for(unsigned mode=0;mode<8;mode++){p.bgmode=mode;for(unsigned x:{0u,17u,255u}){auto got=p.compose(x,0,true);++rawChecks;rawFail+=got.source!=5||got.c15!=c;}}
 }
}
static void pseudoOutput(){PpuState p;p.brightness=15;std::vector<std::uint32_t>fb;
 // Steady-state pixels only: first hires pixel and full DAC delay are separate.
 for(unsigned n=0;n<32;n++){unsigned c=randomColor();palette(p,0,c);fixed(p,c^32767u);
  for(unsigned mode:{0u,1u,2u,3u,4u,7u})for(bool interlace:{false,true})for(unsigned field=0;field<2;field++)for(unsigned y:{0u,17u}){
   p.bgmode=mode;p.setini=8u|unsigned(interlace);const unsigned ends[]={2,31,174,255,512};
   for(unsigned i=0;i<4;i++)p.renderOutputSegment(fb,y,ends[i],ends[i+1],field);
   unsigned row=interlace?y*2+field:y;
   for(unsigned x=2;x<512;x++){++outputChecks;outputFail+=fb[row*512+x]!=rgba(c);}
  }
 }
}
static void emptyMath(){PpuState p;p.brightness=15;p.wobjsel=0x20;p.wh[0]=10;p.wh[1]=20;
 for(unsigned shift:{0u,5u,10u})for(unsigned a=0;a<32;a++)for(unsigned b=0;b<32;b++){
  unsigned main=a<<shift,other=b<<shift;palette(p,0,main);fixed(p,other);
  for(bool selectSub:{false,true})for(bool half:{false,true})for(bool sub:{false,true})for(bool enable:{false,true})for(unsigned clip=0;clip<4;clip++)for(unsigned disable=0;disable<4;disable++)for(bool inside:{false,true}){
   p.cgwsel=(clip<<6)|(disable<<4)|(selectSub?2u:0u);p.cgadsub=(enable?32u:0u)|(half?64u:0u)|(sub?128u:0u);
   bool clipped=region(clip,inside);unsigned want=clipped?0:main;
   if(enable&&!region(disable,inside))want=blend(want,other,sub,half&&!clipped&&!selectSub);
   unsigned got=p.finalMain15(inside?11:29,0);++mathChecks;mathFail+=got!=want;
  }
 }
}
static void opaqueOrHidden(){PpuState p;p.bgmode=0;p.brightness=15;p.ts=2;p.bgsc[1]=4;p.bgnba[1]=2;p.w12sel=0x20;p.wh[0]=10;p.wh[1]=17;p.cgwsel=2;
 const unsigned pattern[8]={0,1,2,3,0,3,2,1};
 for(unsigned y=0;y<8;y++)for(unsigned x=0;x<8;x++)for(unsigned plane=0;plane<2;plane++)if(pattern[x]&(1u<<plane))p.vram[0x4000+y*2+plane]|=1u<<(7-x);
 for(unsigned n=0;n<64;n++){unsigned c=randomColor(),f=c^32767u,colors[4]={c,n==0?0u:randomColor(),randomColor(),randomColor()};palette(p,0,c);fixed(p,f);for(unsigned i=1;i<4;i++)palette(p,32+i,colors[i]);
  for(bool mask:{false,true})for(unsigned x=1;x<32;x++)for(bool half:{false,true})for(bool sub:{false,true}){
   p.tsw=mask?2u:0u;p.cgadsub=32u|(half?64u:0u)|(sub?128u:0u);bool valid=pattern[x%8]&&!(mask&&x>=10&&x<=17);unsigned expectedSub=valid?colors[pattern[x%8]]:c;
   auto got=p.compose(x,0,true);++rawChecks;rawFail+=got.c15!=expectedSub||got.source!=(valid?1u:5u);
   unsigned want=blend(c,valid?expectedSub:f,sub,half&&valid);++mathChecks;mathFail+=p.finalMain15(x,0)!=want;
  }
 }
}
static void transports(){
 for(bool native:{false,true})for(bool stateOnly:{false,true})for(unsigned method=0;method<3;method++)for(unsigned n=0;n<16;n++){
  auto ptr=std::make_unique<SnesRuntime>();auto&h=*ptr;h.headless=true;h.nativeDmaEnabled=native;h.ppuMode=stateOnly?PpuRuntimeMode::StateOnlyNativeScanout:PpuRuntimeMode::VirtualRegisters;
  h.ppu.forceBlank=true;h.beginFrame();h.currentScanline=225;h.currentMasterCycle=100;unsigned c=randomColor(),f=c^32767u;
  unsigned ports[]={0x2121,0x2122,0x2122,0x2132,0x2132,0x2132},values[]={0,c&255u,c>>8,0x20u|(f&31),0x40u|((f>>5)&31),0x80u|((f>>10)&31)};
  for(unsigned i=0;i<6;i++){
   if(method==0)h.write8(ports[i],values[i]);else{auto&d=h.dma[0];d.dmap=0;d.bbad=ports[i]-0x2100;d.a1b=0x7e;h.ram[0x100]=values[i];if(method==1){d.a1t=0x100;d.das=1;h.executeDma(1);}else{d.a2a=0x100;h.hdmaActive=1;h.hdmaLines[0]=1;h.hdmaTransfer[0]=true;h.executeHdmaLine();}}
  }
  h.ppu.forceBlank=false;h.ppu.brightness=15;h.ppu.cgwsel=2;h.ppu.cgadsub=0x60;
  ++transferChecks;transferFail+=h.ppu.compose(1,0,true).c15!=c||h.ppu.finalMain15(1,0)!=blend(c,f,false,false);
 }
}
int main(){rawBackdrop();pseudoOutput();emptyMath();opaqueOrHidden();transports();
 std::printf("SUBSCREEN_REV164 raw=%u raw_fail=%u output=%u output_fail=%u math=%u math_fail=%u transfers=%u transfer_fail=%u\n",rawChecks,rawFail,outputChecks,outputFail,mathChecks,mathFail,transferChecks,transferFail);
 return rawFail||outputFail||mathFail||transferFail?1:0;
}
