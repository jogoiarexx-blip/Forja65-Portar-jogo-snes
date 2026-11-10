#include <cmath>

void scene(PpuState& p){
 p.bgmode=7;p.brightness=15;p.tm=1;
 for(unsigned y=0;y<128;++y)for(unsigned x=0;x<128;++x)p.vram[(y*128+x)*2]=(x*17+y*31)&255;
 for(unsigned t=0;t<256;++t)for(unsigned y=0;y<8;++y)for(unsigned x=0;x<8;++x)p.vram[(t*64+y*8+x)*2+1]=(t+x+y*8)%255+1;
 for(unsigned i=0;i<256;++i)p.cgram[i*2]=i;
}
unsigned texel(int x,int y){unsigned ux=unsigned(x)&1023u,uy=unsigned(y)&1023u;
 unsigned tile=((ux/8)*17+(uy/8)*31)&255u;return (tile+(ux%8)+(uy%8)*8)%255+1;}
bool golden(const char* name,int A,int B,unsigned H,unsigned V,int sx,int sy,int tx,int ty){
 PpuState p;scene(p);p.m7[0]=(std::uint16_t)A;p.m7[1]=(std::uint16_t)B;
 p.m7Hofs=H;p.m7Vofs=V;auto q=p.sampleMode7(0,sx,sy);unsigned expected=texel(tx,ty);
 if(!q.valid||q.c15!=expected){std::cerr<<name<<": expected color "<<expected<<", got "<<q.c15<<"\n";return false;}return true;
}
int s13(unsigned q){q%=8192;return q>=4096?int(q)-8192:int(q);}
int s16(unsigned q){return q>=32768?int(q)-65536:int(q);}
// Independent mathematical oracle: Euclidean remainders and floating floor.
// All products are integers below 2^27, exactly representable as double.
int clipReference(int q){int rem=q%1024;if(rem<0)rem+=1024;return q<0?rem-1024:rem;}
double dropFraction(double q){return std::floor(q/64.0)*64.0;}
std::pair<int,int> reference(const PpuState& p,int sx,int sy){
 const int x=(p.m7sel%2)?255-sx:sx,y=((p.m7sel/2)%2)?255-sy:sy;
 const int a=s16(p.m7[0]),b=s16(p.m7[1]),c=s16(p.m7[2]),d=s16(p.m7[3]);
 const int cx=s13(p.m7[4]),cy=s13(p.m7[5]);
 const int h=clipReference(s13(p.m7Hofs)-cx),v=clipReference(s13(p.m7Vofs)-cy);
 double ox=dropFraction(double(a)*h)+dropFraction(double(b)*v)+dropFraction(double(b)*y)+double(cx)*256;
 double oy=dropFraction(double(c)*h)+dropFraction(double(d)*v)+dropFraction(double(d)*y)+double(cy)*256;
 return {int(std::floor((ox+double(a)*x)/256.0)),int(std::floor((oy+double(c)*x)/256.0))};
}
unsigned coordinateChecks{},pixelChecks{};
void coordinates(const PpuState& p,int x,int y){
 auto expected=reference(p,x,y),got=p.mode7Coordinates(x,y);++coordinateChecks;
 if(got!=expected){std::cerr<<"coordinates got "<<got.first<<","<<got.second<<" expected "<<expected.first<<","<<expected.second<<"\n";assert(false);}
}
void pixels(const PpuState& p,int x,int y){
 auto [tx,ty]=reference(p,x,y);bool outside=tx<0||ty<0||tx>=1024||ty>=1024;
 bool transparent=(p.m7sel&0x80)&&outside&&!(p.m7sel&0x40);
 unsigned raw=texel(tx,ty);
 if((p.m7sel&0xc0)==0xc0&&outside)raw=(unsigned(tx)%8+8*(unsigned(ty)%8))%255+1;
 for(unsigned bg=0;bg<2;++bg){
  auto q=p.sampleMode7(bg,x,y);++pixelChecks;
  bool valid=!transparent&&(bg==0||((p.setini&0x40)&&(raw%128)!=0));
  assert(q.valid==valid);if(!valid)continue;
  unsigned expected=bg==1?raw%128:((p.cgwsel&1)?p.directColor15(0,raw):raw);
  assert(q.source==bg&&q.c15==expected&&q.priority==(bg==0?7:(raw>=128?11:3)));
 }
}
void w16(PpuState& p,unsigned address,unsigned value){p.write((std::uint16_t)address,(std::uint8_t)value);p.write((std::uint16_t)address,(std::uint8_t)(value>>8));}
int main(){
 bool ok=true;
 ok=golden("negative fraction floors to -1",-1,0,0,0,1,0,-1,0)&&ok;
 ok=golden("individual products lose six low bits",63,63,1,3,0,1,0,0)&&ok;
 ok=golden("positive delta clipping",128,0,1024,0,0,0,0,0)&&ok;
 ok=golden("negative delta clipping",128,0,0x1bff,0,0,0,-1,0)&&ok;
 if(!ok)return 1;
 PpuState p;scene(p);
 const std::pair<int,int> points[]={{0,0},{1,1},{127,63},{255,255}};
 // Every signed 16-bit value in each of A, B, C and D; extreme centers/offsets.
 for(unsigned raw=0;raw<65536;++raw)for(unsigned slot=0;slot<4;++slot){
  p.m7[0]=256;p.m7[1]=63;p.m7[2]=0xffff;p.m7[3]=128;p.m7[slot]=raw;
  p.m7[4]=0x1000;p.m7[5]=0x0fff;p.m7Hofs=0x0fff;p.m7Vofs=0x1801;p.m7sel=raw&3;
  for(auto [x,y]:points)coordinates(p,x,y);
 }
 // Exhaust every realizable offset-minus-center difference, in both axes.
 for(int delta=-8191;delta<=8191;++delta){
  int center=delta<0?4095:-4096,offset=center+delta;
  p.m7[0]=32767;p.m7[1]=0x8000;p.m7[2]=0xffff;p.m7[3]=63;
  p.m7[4]=p.m7[5]=(std::uint16_t)center;p.m7Hofs=p.m7Vofs=(std::uint16_t)offset;p.m7sel=delta&3;
  for(auto [x,y]:points)coordinates(p,x,y);
 }
 unsigned seed=0x65c816;auto rnd=[&](){seed^=seed<<13;seed^=seed>>17;seed^=seed<<5;return seed;};
 // Matrices, centers, aliases, both flips, all repeat/fill modes and EXTBG.
 for(unsigned n=0;n<250000;++n){
  for(auto& value:p.m7)value=(std::uint16_t)rnd();
  p.m7Hofs=(std::uint16_t)rnd();p.m7Vofs=(std::uint16_t)rnd();p.m7sel=(std::uint8_t)rnd();
  p.setini=(std::uint8_t)(rnd()&0x40);p.cgwsel=(std::uint8_t)(rnd()&1);
  int x=rnd()%256,y=rnd()%256;coordinates(p,x,y);pixels(p,x,y);
 }
 // Empty texels are transparent on both layers, not an opaque palette index 0.
 PpuState empty;scene(empty);empty.setini=0x40;empty.vram[1]=0;
 assert(!empty.sampleMode7(0,0,0).valid&&!empty.sampleMode7(1,0,0).valid);
 // Matrix mutation is visible in the next raster segment, including fractions.
 PpuState live;scene(live);w16(live,0x211b,256);std::vector<std::uint32_t> frame;
 live.renderOutputSegment(frame,0,0,4);const auto first=frame[0],last=frame[3];w16(live,0x211b,0xffff);
 live.renderOutputSegment(frame,0,4,8);assert(frame[0]==first&&frame[3]==last&&frame[4]==live.rgba15(texel(-1,0)));
 // HDMA uploads a negative fractional matrix through both backends/modes.
 for(bool native:{false,true})for(bool indirect:{false,true})for(bool state:{false,true}){
  SnesRuntime hw;hw.headless=true;hw.nativeDmaEnabled=native;
  hw.ppuMode=state?PpuRuntimeMode::StateOnlyNativeScanout:PpuRuntimeMode::VirtualRegisters;
  scene(hw.ppu);hw.ppu.forceBlank=true;hw.beginFrame();hw.currentScanline=225;hw.currentMasterCycle=100;
  auto& d=hw.dma[0];d.dmap=2|(indirect?0x40:0);d.bbad=0x1b;d.a1b=d.dasb=0x7e;d.a2a=d.das=0x100;
  hw.ram[0x100]=hw.ram[0x101]=0xff;hw.hdmaActive=1;hw.hdmaLines[0]=1;hw.hdmaTransfer[0]=true;
  hw.executeHdmaLine();assert(hw.ppu.m7[0]==0xffff&&hw.hwUsage.hdmaBytes==2);
  auto q=hw.ppu.sampleMode7(0,1,0);assert(q.valid&&q.c15==texel(-1,0));
 }
 std::cout<<"PPU_MODE7_MATH_V0434_PASS coordinate_checks="<<coordinateChecks<<" pixel_checks="<<pixelChecks
 <<" coefficient_values=65536 delta_values=16383 random_states=250000 hdma_cases=8 raster=live\n";
}
