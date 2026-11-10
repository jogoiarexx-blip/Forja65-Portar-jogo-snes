#include "forja_checkpoint.hpp"
#include <cstdio>
#include <memory>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
// Independent byte-stream model of the two shared BG latches in ares/bsnes.
struct ScrollOracle{
 unsigned previousAny{},previousHorizontal{},previousMode7{},x[4]{},y[4]{},m[6]{},mh{},mv{};
 void write(unsigned port,unsigned value){
  if(port>=0x210d&&port<=0x2114){unsigned index=port-0x210d,bg=index/2;
   if(index%2)y[bg]=value*256+previousAny;
   else{x[bg]=value*256+(previousAny/8)*8+previousHorizontal%8;previousHorizontal=value;}
   previousAny=value;
   if(index<2){if(index)mv=value*256+previousMode7;else mh=value*256+previousMode7;previousMode7=value;}
  }else if(port>=0x211b&&port<=0x2120){m[port-0x211b]=value*256+previousMode7;previousMode7=value;}
 }
};
static unsigned registerChecks{},registerFail{},pixelChecks{},pixelFail{},transferChecks{},transferFail{},checkpointChecks{},checkpointFail{};
static void compare(const PpuState&p,const ScrollOracle&r){
 for(unsigned bg=0;bg<4;bg++){registerChecks+=2;registerFail+=p.scrollX[bg]!=r.x[bg];registerFail+=p.scrollY[bg]!=r.y[bg];}
 for(unsigned i=0;i<6;i++){++registerChecks;registerFail+=p.m7[i]!=r.m[i];}
 registerChecks+=2;registerFail+=p.m7Hofs!=r.mh;registerFail+=p.m7Vofs!=r.mv;
}
static const unsigned pattern[8]={1,2,3,1,3,2,1,2};
static void scene(PpuState&p,unsigned bg){
 p.bgmode=0;p.brightness=15;p.tm=1u<<bg;p.bgsc[bg]=4;p.bgnba[bg]=2;
 for(unsigned y=0;y<8;y++)for(unsigned x=0;x<8;x++)for(unsigned plane=0;plane<2;plane++)if(pattern[x]&(1u<<plane))p.vram[0x4000+y*2+plane]|=1u<<(7-x);
 for(unsigned i=0;i<128;i++)p.cgram[i*2]=i;
}
static void directed(){
 for(unsigned from=0;from<4;from++)for(unsigned to=0;to<4;to++)for(unsigned low=0;low<8;low++)for(unsigned v=0;v<8;v++){
  PpuState p;scene(p,to);ScrollOracle r;
  unsigned ports[]={0x210du+from*2,0x210eu+((from+1)%4)*2,0x210du+to*2},values[]={low,0xa0u+v,2};
  for(unsigned i=0;i<3;i++){p.write(ports[i],values[i]);r.write(ports[i],values[i]);compare(p,r);}
  for(unsigned x=0;x<16;x++){auto got=p.compose(x,0,false);unsigned want=to*32+pattern[(x+r.x[to])%8];++pixelChecks;pixelFail+=!got.valid||got.source!=to||got.c15!=want;}
 }
}
static void randomWrites(){
 PpuState p;ScrollOracle r;unsigned state=0x16365816;
 const unsigned ports[]={0x210d,0x210e,0x210f,0x2110,0x2111,0x2112,0x2113,0x2114,0x211b,0x211c,0x211d,0x211e,0x211f,0x2120,0x2105,0x2133};
 for(unsigned i=0;i<50000;i++){
  state=state*1664525u+1013904223u;unsigned port=ports[(state>>16)%16],value=state>>24;
  p.write(port,value);r.write(port,value);if(i%11==0)p.read(0x213f);compare(p,r);
 }
}
static void transports(){
 for(bool native:{false,true})for(bool stateOnly:{false,true})for(unsigned method=0;method<3;method++)for(unsigned target=0;target<4;target++){
  auto ptr=std::make_unique<SnesRuntime>();auto&h=*ptr;h.headless=true;h.nativeDmaEnabled=native;h.ppuMode=stateOnly?PpuRuntimeMode::StateOnlyNativeScanout:PpuRuntimeMode::VirtualRegisters;
  h.ppu.forceBlank=true;h.beginFrame();h.currentScanline=225;h.currentMasterCycle=100;ScrollOracle r;
  const unsigned ports[]={0x210d,0x2114,0x211b,0x210du+target*2,0x2112,0x210fu};const unsigned values[]={5,0xa6,0x19,2,0xd3,1};
  for(unsigned i=0;i<6;i++){
   if(method==0)h.write8(ports[i],values[i]);
   else{auto&d=h.dma[0];d.dmap=0;d.bbad=ports[i]-0x2100;d.a1b=0x7e;h.ram[0x100]=values[i];
    if(method==1){d.a1t=0x100;d.das=1;h.executeDma(1);}
    else{d.a2a=0x100;h.hdmaActive=1;h.hdmaLines[0]=1;h.hdmaTransfer[0]=true;h.executeHdmaLine();}}
   r.write(ports[i],values[i]);++transferChecks;
   for(unsigned bg=0;bg<4;bg++)if(h.ppu.scrollX[bg]!=r.x[bg]||h.ppu.scrollY[bg]!=r.y[bg]){++transferFail;break;}
   compare(h.ppu,r);
  }
 }
}
static void checkpoints(){
 for(unsigned from=0;from<4;from++)for(unsigned to=0;to<4;to++)for(unsigned low:{1u,3u,5u,7u}){
  auto a=std::make_unique<SnesRuntime>(),b=std::make_unique<SnesRuntime>();a->headless=b->headless=true;CpuState ca,cb;ScrollOracle r;
  a->ppu.write(0x210d+from*2,low);r.write(0x210d+from*2,low);a->ppu.write(0x2114,0xa6);r.write(0x2114,0xa6);
  forja_checkpoint::decode(forja_checkpoint::encode(ca,*a),cb,*b);
  a->ppu.write(0x210d+to*2,2);b->ppu.write(0x210d+to*2,2);r.write(0x210d+to*2,2);
  ++checkpointChecks;checkpointFail+=a->ppu.scrollX[to]!=r.x[to]||b->ppu.scrollX[to]!=r.x[to]||forja_checkpoint::encode(ca,*a)!=forja_checkpoint::encode(cb,*b);
 }
}
int main(){directed();randomWrites();transports();checkpoints();
 std::printf("BG_SCROLL_REV163 registers=%u register_fail=%u pixels=%u pixel_fail=%u transfers=%u transfer_fail=%u checkpoints=%u checkpoint_fail=%u\n",registerChecks,registerFail,pixelChecks,pixelFail,transferChecks,transferFail,checkpointChecks,checkpointFail);
 return registerFail||pixelFail||transferFail||checkpointFail?1:0;
}
