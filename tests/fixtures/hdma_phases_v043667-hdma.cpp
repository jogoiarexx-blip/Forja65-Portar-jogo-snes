#include "runtime.hpp"
#include <iostream>
static unsigned cases=0,failures=0;
static void check(bool ok,const char*what){++cases;if(!ok){if(failures<16)std::cerr<<what<<"\n";failures++;}}
static void line(SnesRuntime&h){h.currentScanline=10;h.currentMasterCycle=1106;h.wramRefreshAppliedThisLine=true;h.hdmaExecutedThisLine=true;h.executeHdmaLine();}
static void setup(SnesRuntime&h,unsigned mask){h.io.hdmaen=(std::uint8_t)mask;h.beginFrame();h.advanceCpuMasterCycles(12u+(unsigned)(h.cpuMasterClock&7u));}
int main(){
 for(bool native:{false,true})for(bool indirect:{false,true}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.ppu.forceBlank=true;auto&d=h.dma[0];d.a1b=d.dasb=0x7e;d.a1t=0x100;d.bbad=0x26;d.dmap=indirect?0x40:0;d.a2a=0x9876;d.ntrl=0x87;
  if(indirect){h.ram[0x100]=0x81;h.ram[0x101]=0;h.ram[0x102]=2;h.ram[0x103]=0x82;h.ram[0x104]=0;h.ram[0x105]=3;h.ram[0x106]=0;h.ram[0x107]=0x45;h.ram[0x200]=0x11;h.ram[0x300]=0x22;h.ram[0x301]=0x33;}
  else{h.ram[0x100]=0x81;h.ram[0x101]=0x11;h.ram[0x102]=0x82;h.ram[0x103]=0x22;h.ram[0x104]=0x33;h.ram[0x105]=0;}
  h.io.hdmaen=1;h.beginFrame();h.advanceCpuMasterCycles(11);
  check(d.a2a==0x9876&&d.ntrl==0x87&&h.hwUsage.hdmaBytes==0,"HDMA setup must not fetch before H12 divider event");
  const auto clock=h.cpuMasterClock;h.advanceCpuMasterCycles(1);
  check(h.cpuMasterClock-clock==1+SnesRuntime::DMA_SYNC_MC+(indirect?24u:8u),"setup accounts descriptor/pointer clocks at separate event");
  check(d.ntrl==0x81&&d.a2a==(indirect?0x103:0x101),"setup prefetches initial descriptor and advances table pointer");
  check(!indirect||d.das==0x200,"setup prefetches initial indirect pointer");
  check(h.hwUsage.hdmaBytes==0&&h.ppu.wh[0]==0,"setup has no B-bus payload transfer");
  // Changes after setup cannot replace a descriptor or indirect pointer already loaded.
  h.ram[0x100]=0;if(indirect){h.ram[0x101]=0xff;h.ram[0x102]=0xff;}
  const auto firstClock=h.cpuMasterClock;line(h);
  check(h.ppu.wh[0]==0x11,"line uses descriptor/pointer prefetched at setup");
  check(d.ntrl==0x82&&d.a2a==(indirect?0x106:0x103),"first line reloads next descriptor immediately after payload");
  check(!indirect||d.das==0x300,"first line loads next indirect pointer before next scanline");
  check(h.cpuMasterClock-firstClock==SnesRuntime::DMA_SYNC_MC+8+(indirect?24u:8u),"line reload accounts descriptor and indirect pointer costs");
  if(indirect){h.ram[0x103]=0;h.ram[0x104]=0xff;h.ram[0x105]=0xff;}else h.ram[0x102]=0;
  line(h);check(h.ppu.wh[0]==0x22&&d.ntrl==0x81,"later mutation cannot replace already-loaded next entry");
  const auto terminalClock=h.cpuMasterClock;line(h);
  check(h.ppu.wh[0]==0x33&&h.hdmaActive==0&&h.hdmaEnded==1&&d.ntrl==0,"terminal descriptor ends channel on final payload line");
  check(d.a2a==(indirect?0x108:0x106),"terminal reload consumes descriptor and partial pointer immediately");
  check(!indirect||d.das==0x4500,"final indirect channel retains partial pointer high-byte result");
  check(h.cpuMasterClock-terminalClock==SnesRuntime::DMA_SYNC_MC+8+(indirect?16u:8u),"terminal reload costs included in final payload line");
 }
 // All payloads precede every channel reload: a later reverse payload can
 // change an earlier channel's descriptor before its advance phase reads it.
 for(bool native:{false,true}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.ppu.forceBlank=true;
  auto&a=h.dma[0];a.a1b=0x7e;a.a1t=0x100;a.bbad=0x26;
  auto&b=h.dma[1];b.a1b=b.dasb=0x7e;b.a1t=0x180;b.bbad=0x3b;b.dmap=0xc0;
  h.ram[0x100]=0x81;h.ram[0x101]=0x11;h.ram[0x102]=0x01;h.ram[0x103]=0x77;h.ram[0x104]=0x66;h.ram[0x105]=0;
  h.ram[0x180]=0x81;h.ram[0x181]=2;h.ram[0x182]=1;h.ram[0x183]=0;h.ram[0x184]=0x99;
  h.ppu.cgAddr=0;h.ppu.cgHigh=false;h.ppu.cgram[0]=0x82;
  setup(h,3);const auto start=h.cpuMasterClock;line(h);
  check(h.ram[0x102]==0x82,"later channel reverse payload mutates earlier table");
  check(a.ntrl==0x82&&a.a2a==0x103,"all-channel payload phase precedes earlier channel descriptor reload");
  check(h.hdmaActive==1&&b.ntrl==0&&b.das==0x9900,"second channel terminal indirect pointer consumed in advance phase");
  check(h.cpuMasterClock-start==SnesRuntime::DMA_SYNC_MC+16+8+16,"multi-channel reload exact costs");
  line(h);check(h.ppu.wh[0]==0x77,"next line uses descriptor written by later channel payload");
 }
 // Software NLTR writes change the countdown/repeat setting while preserving
 // the already scheduled next payload. Expiration reloads on that same line.
 for(bool native:{false,true}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;auto&d=h.dma[0];d.a1b=0x7e;d.a1t=0x100;d.bbad=0x26;
  h.ram[0x100]=0x84;h.ram[0x101]=0x11;h.ram[0x102]=0x22;h.ram[0x103]=0x81;h.ram[0x104]=0x44;h.ram[0x105]=0;
  setup(h,1);line(h);h.write8(0x430a,2);line(h);
  check(h.ppu.wh[0]==0x22&&d.ntrl==1&&!h.hdmaTransfer[0],"manual NLTR preserves scheduled payload then applies nonrepeat");
  line(h);check(h.ppu.wh[0]==0x22&&d.ntrl==0x81&&d.a2a==0x104&&h.hdmaTransfer[0],"manual counter expiration reloads new descriptor without payload");
  line(h);check(h.ppu.wh[0]==0x44&&h.hdmaActive==0,"reloaded descriptor transfers on following line");
 }
 // Initial indirect descriptor/pointer fetches wrap within A1B.
 for(bool native:{false,true}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;auto&d=h.dma[0];d.dmap=0x40;d.a1b=d.dasb=0x7e;d.a1t=0xffff;d.bbad=0x26;
  h.ram[0xffff]=0x81;h.ram[0]=0x34;h.ram[1]=0x12;h.ram[2]=0;h.ram[0x1234]=0x6a;setup(h,1);
  check(d.a2a==2&&d.das==0x1234,"setup pointer fetch wraps within source bank");line(h);check(h.ppu.wh[0]==0x6a&&h.hdmaActive==0,"wrapped setup pointer feeds first payload and immediate terminal reload");
 }
 // Disabling before the setup event prevents resetting the hardware cursor.
 for(bool native:{false,true}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;auto&d=h.dma[0];d.a1b=0x7e;d.a1t=0x100;d.a2a=0x9876;d.ntrl=0x85;h.ram[0x100]=0x81;
  h.hdmaEnded=1;h.io.hdmaen=1;h.beginFrame();
  check(d.a2a==0x9876&&d.ntrl==0x85&&h.hdmaEnded==1,"frame boundary preserves prior HDMA cursor and completed flag until setup");
  h.advanceCpuMasterCycles(6);h.write8(0x420c,0);h.advanceCpuMasterCycles(6);
  check(d.a2a==0x9876&&d.ntrl==0x85&&h.hdmaEnded==0,"disabled channel keeps cursor at setup while completed latch resets");
  const auto reads=h.hwUsage.wramReads;h.setHdmaEnable(1);h.advanceCpuMasterCycles(40);
  check(d.a2a==0x9876&&d.ntrl==0x85&&h.hwUsage.wramReads==reads,"midframe enable does not trigger setup or reset cursor");
 }
 // During an enabled setup all channel transfer latches are armed,
 // including disabled channels that software may enable later.
 for(bool native:{false,true})for(bool prepared:{false,true}){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.dma[0].a1b=0x7e;h.dma[0].a1t=0x100;h.ram[0x100]=0;
  auto&d=h.dma[1];d.a1b=0x7e;d.a2a=0x200;d.bbad=0x26;h.ram[0x200]=0x6b;h.ram[0x201]=0x82;h.ram[0x202]=0x77;
  setup(h,1);check(h.hdmaTransfer[1],"setup arms disabled channel transfer latch when any channel enabled");
  if(prepared){h.setDmaReg(1,10,0x81);}h.setHdmaEnable(2);line(h);
  check(h.ppu.wh[0]==0x6b,"midframe enabled channel performs already-armed first payload");
  if(prepared)check(d.ntrl==0x82&&d.a2a==0x202,"prepared midframe counter expires and reloads after payload");
  else check(d.ntrl==0xff&&d.a2a==0x201&&h.hdmaLines[1]==127,"unprepared zero NTRL wraps to FF without descriptor reload");
 }
 // Exhaust the full descriptor-byte domain against the source counter
 // equations: $80 is 128 nonrepeating lines; $81-$FF repeat each line.
 for(bool native:{false,true})for(bool indirect:{false,true})for(unsigned desc=1;desc<256;desc++){
  SnesRuntime h;h.headless=true;h.nativeDmaEnabled=native;h.ppu.forceBlank=true;
  auto&d=h.dma[0];d.dmap=indirect?0x40:0;d.a1b=d.dasb=0x7e;d.a1t=0x100;d.bbad=0x26;
  const unsigned count=(desc&127u)?(desc&127u):128u,transfers=desc>128u?count:1u;
  h.ram[0x100]=(std::uint8_t)desc;
  if(indirect){h.ram[0x101]=0;h.ram[0x102]=2;h.ram[0x103]=0;h.ram[0x104]=0;}
  for(unsigned n=0;n<transfers;n++)h.ram[(indirect?0x200:0x101)+n]=(std::uint8_t)(n+1u);
  if(!indirect)h.ram[0x101+transfers]=0;
  setup(h,1);check(d.ntrl==desc,"all descriptor bytes visible immediately after setup");
  for(unsigned n=0;n<count;n++){
   const auto start=h.cpuMasterClock;line(h);
   const unsigned sent=desc>128u?n+1u:1u;
   check(h.hwUsage.hdmaBytes==sent,"descriptor repeat bit determines exact payload count");
   check(d.ntrl==(n+1u==count?0u:desc-n-1u),"descriptor countdown and same-line terminal readback");
   check(h.hdmaActive==(n+1u==count?0u:1u),"descriptor completion occurs on last counted line");
   const auto expected=SnesRuntime::DMA_SYNC_MC+8u+((n==0||desc>128u)?8u:0u)+((indirect&&n+1u==count)?8u:0u);
   check(h.cpuMasterClock-start==expected,"descriptor sweep exact per-line table/payload/terminal-pointer clocks");
  }
 }
 std::cout<<"HDMA_PHASES_V043667_HDMA cases="<<cases<<" failures="<<failures<<"\n";return failures?1:0;
}
