'use strict';
// Real register writes and visible pixels; no assertions on new private fields.
require('./fixtures/run_spc_probe_v0431')('ppu-mode7-latch-v0433',String.raw`
void scene(PpuState& p){
 p.bgmode=7;p.brightness=15;p.tm=1;
 for(unsigned y=0;y<128;++y)for(unsigned x=0;x<128;++x)p.vram[(y*128+x)*2]=(x*17+y*31)&255;
 for(unsigned t=0;t<256;++t)for(unsigned y=0;y<8;++y)for(unsigned x=0;x<8;++x)p.vram[(t*64+y*8+x)*2+1]=(t+x+y*8)%255+1;
 for(unsigned i=0;i<256;++i){p.cgram[i*2]=i;p.cgram[i*2+1]=0;}
 p.m7[0]=p.m7[3]=256;
}
unsigned color(int x,int y){unsigned ux=unsigned(x)&1023u,uy=unsigned(y)&1023u;
 unsigned tile=((ux/8)*17+(uy/8)*31)&255u;return (tile+(ux%8)+(uy%8)*8)%255+1;}
int signed13(unsigned q){q%=8192;return q>=4096?int(q)-8192:int(q);}
void pixel(const PpuState& p,int x,int y,unsigned h,unsigned v){auto q=p.sampleMode7(0,x,y);
 assert(q.valid&&q.c15==color(x+signed13(h),y+signed13(v)));}
int main(){
 // M7A primes only the Mode 7 latch; BG1 uses its independent BG latch.
 {PpuState p;scene(p);p.write(0x211B,5);p.write(0x210D,0);p.m7[0]=256;
 assert(p.scrollX[0]==0);auto q=p.sampleMode7(0,0,0);
 if(!q.valid||q.c15!=6){std::cerr<<"Mode7 horizontal pixel: expected 6, got "<<q.c15<<"\n";return 1;}}
 // BG2 primes only the BG latch, while the previous matrix byte survives.
 {PpuState p;scene(p);p.write(0x211D,2);p.write(0x210F,9);p.write(0x210E,0);p.m7[2]=0;
 assert(p.scrollY[0]==9);pixel(p,0,0,0,2);}
 // Independent reference model of shared byte latches over arbitrary writes.
 PpuState p;scene(p);unsigned bgByte=0,bgHByte=0,m7Byte=0,h=0,v=0,bgx[4]{},bgy[4]{},matrix[6]{};
 unsigned seed=0x65c816;const unsigned ports[]={0x210D,0x210E,0x210F,0x2110,0x2111,0x2112,0x2113,0x2114,0x211B,0x211C,0x211D,0x211E,0x211F,0x2120};
 for(unsigned n=0;n<50000;++n){seed=seed*1664525u+1013904223u;unsigned a=ports[(seed>>16)%14],b=seed>>24;
  // Reset only matrix values for the write-oracle check; scroll/latches persist.
  for(unsigned i=0;i<6;++i){p.m7[i]=matrix[i];}p.write(a,(std::uint8_t)b);
  if(a<=0x2114){unsigned i=a-0x210D,k=i/2;
   if(i%2)bgy[k]=b*256+bgByte;else{bgx[k]=b*256+(bgByte/8)*8+bgHByte%8;bgHByte=b;}
   bgByte=b;if(i<2){if(i) v=b*256+m7Byte;else h=b*256+m7Byte;m7Byte=b;}
  }else{matrix[a-0x211B]=b*256+m7Byte;m7Byte=b;}
  for(unsigned i=0;i<4;++i){assert(p.scrollX[i]==bgx[i]);assert(p.scrollY[i]==bgy[i]);}
  for(unsigned i=0;i<6;++i)assert(p.m7[i]==matrix[i]);
  p.m7[0]=p.m7[3]=256;p.m7[1]=p.m7[2]=p.m7[4]=p.m7[5]=0;
  pixel(p,int(n%256),int(n%224),h,v);
 }
 // Changing modes keeps both register values; no dependency on selected mode at write time.
 p.bgmode=1;p.write(0x211B,7);p.write(0x210D,0);p.m7[0]=256;p.bgmode=7;pixel(p,0,0,7,v);
 // Signed offsets, wrap, flips, EXTBG and direct color still use Mode 7 offsets.
 for(unsigned offset:{0u,3u,0x0fffu,0x1000u,0x1fffu}){
  PpuState edge;scene(edge);edge.write(0x210D,(std::uint8_t)offset);edge.write(0x210D,(std::uint8_t)(offset>>8));
  edge.write(0x210E,0);edge.write(0x210E,0);
  pixel(edge,0,0,offset,0);edge.m7sel=3;
  auto q=edge.sampleMode7(0,1,2);unsigned ci=color(254+signed13(offset),253);
  assert(q.valid&&q.c15==ci);edge.cgwsel=1;
  q=edge.sampleMode7(0,1,2);assert(q.valid&&q.c15==edge.directColor15(0,ci));
  edge.setini=0x40;q=edge.sampleMode7(1,1,2);
  assert(q.valid==((ci&127)!=0));if(q.valid)assert(q.c15==(ci&127)&&q.priority==((ci&128)?11:3));
 }
 // Raster segments observe a new scroll immediately without changing past pixels.
 PpuState live;scene(live);std::vector<std::uint32_t> f;live.renderOutputSegment(f,0,0,4);
 const auto old=f[0];live.write(0x211B,5);live.write(0x210D,0);live.m7[0]=256;
 live.renderOutputSegment(f,0,4,8);assert(f[0]==old&&f[4]==live.rgba15(color(9,0)));
 // CPU writes, MDMA and HDMA all enter the same latch path, in both backends.
 for(bool native:{false,true})for(bool state:{false,true})for(bool hdma:{false,true}){
  SnesRuntime hw;hw.headless=true;hw.nativeDmaEnabled=native;
  hw.ppuMode=state?PpuRuntimeMode::StateOnlyNativeScanout:PpuRuntimeMode::VirtualRegisters;
  scene(hw.ppu);hw.ppu.forceBlank=true;hw.beginFrame();hw.currentScanline=225;hw.currentMasterCycle=100;
  hw.write8(0x211B,5);auto& d=hw.dma[0];d.a1b=0x7e;d.dmap=0;d.bbad=0x0d;
  hw.ram[0x100]=0;
  if(hdma){d.a2a=0x100;hw.hdmaActive=1;hw.hdmaLines[0]=1;hw.hdmaTransfer[0]=true;hw.executeHdmaLine();}
  else{d.a1t=0x100;d.das=1;hw.executeDma(1);}
  hw.ppu.m7[0]=256;assert(hw.ppu.scrollX[0]==0);pixel(hw.ppu,0,0,5,0);
  hw.write8(0x210E,0x34);hw.write8(0x211F,0x12);assert(hw.ppu.m7[4]==0x1234);
  assert((hdma?hw.hwUsage.hdmaBytes:hw.hwUsage.dmaBytes)==1);
 }
 std::cout<<"PPU_MODE7_LATCH_V0433_PASS random_writes=50000 horizontal/vertical=independent matrices=shared modeswitch=preserved raster=live\n";
}
`);
