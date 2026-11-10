#include "runtime.hpp"
#include <iostream>
#include <array>
static unsigned failures=0,cases=0;
static void check(bool ok,const char*what){++cases;if(!ok){if(failures<12)std::cerr<<what<<"\n";++failures;}}
int main(int argc,char**argv){
 const bool dmaOnly=argc>1&&std::string(argv[1])=="dma";
 const bool ppuOnly=argc>1&&std::string(argv[1])=="ppu";
 if(!ppuOnly){
  SnesRuntime h;h.headless=true;h.ppu.forceBlank=true;
  const std::array<unsigned,8> banks={0,0x3f,0x80,0xbf,1,0x20,0x81,0xa0};
  const std::array<unsigned,12> offsets={0x2100,0x2138,0x2180,0x21ff,0x4000,0x4016,0x41ff,0x4200,0x4211,0x421f,0x4301,0x437a};
  for(bool native:{false,true})for(auto bank:banks)for(auto offset:offsets){
   h.nativeDmaEnabled=native;h.ppu.oamAddr=7;h.ppu.oamFlip=false;h.ppu.oam[14]=0x5a;
   h.io.irqPending=true;h.io.nmiPending=true;h.io.wramPortAddr=123;h.ram[123]=0x5a;
   h.ppu.regs[0]=0x5a;h.dma[0].bbad=0x5a;h.cpuDataBus=0xe7;
   bool done=false;const auto v=h.dmaTransferByte((bank<<16)|offset,0x2126,false,done);
   check(v==0&&h.ppu.wh[0]==0,"forbidden A read must supply zero to B-bus");
   check(h.ppu.oamAddr==7&&!h.ppu.oamFlip&&h.io.wramPortAddr==123&&h.io.irqPending&&h.io.nmiPending,"forbidden A read must have no I/O side effects");
   h.ppu.cgAddr=0;h.ppu.cgHigh=false;h.ppu.cgram[0]=0xa5;h.ppu.inidisp=0x5a;h.io.nmitimen=0x5a;h.dma[0].bbad=0x5a;
   h.dmaTransferByte((bank<<16)|offset,0x213b,true,done);
   check(h.ppu.cgHigh,"reverse DMA must still read B-bus with forbidden A destination");
   check(h.ppu.inidisp==0x5a&&h.io.nmitimen==0x5a&&h.dma[0].bbad==0x5a&&h.ppu.oamAddr==7&&h.io.wramPortAddr==123,"forbidden A write must not mutate I/O");
  }
  // Ordinary DMA/HDMA callers must use the same decoder.
  for(bool native:{false,true})for(bool reverse:{false,true})for(bool hdma:{false,true}){
   SnesRuntime x;x.headless=true;x.nativeDmaEnabled=native;x.ppu.forceBlank=true;x.beginFrame();x.hdmaSetupComplete=true;x.ppu.wh[0]=0x5a;
   auto&d=x.dma[0];d.dmap=reverse?0x80:0;d.bbad=reverse?0x3b:0x26;d.a1b=0x80;d.a1t=d.a2a=0x2100;d.das=1;
   x.ppu.inidisp=0x6c;x.ppu.cgAddr=0;x.ppu.cgHigh=false;x.ppu.cgram[0]=0xa5;
   if(hdma){x.hdmaActive=1;x.hdmaLines[0]=2;x.hdmaTransfer[0]=true;x.executeHdmaLine();}else x.executeDma(1);
   check(reverse?x.ppu.inidisp==0x6c:x.ppu.wh[0]==0,"DMA/HDMA integration A-bus decode");
   check((hdma?d.a2a:d.a1t)==0x2101,"forbidden access must still advance DMA address");
  }
  // Valid system-bank A-bus WRAM access and CPU I/O access remain functional.
  for(bool native:{false,true}){h.nativeDmaEnabled=native;bool done=false;h.ram[0x123]=0x79;h.dmaTransferByte(0x800123,0x2126,false,done);check(h.ppu.wh[0]==0x79,"valid A-bus source");h.write8(0x802100,0x8f);check(h.ppu.inidisp==0x8f,"CPU keeps access to its own I/O");}
 }
 if(!dmaOnly){
  PpuState p;
  const std::array<unsigned,18> writeOnly={0x2104,0x2105,0x2106,0x2108,0x2109,0x210a,0x2114,0x2115,0x2116,0x2118,0x2119,0x211a,0x2124,0x2125,0x2126,0x2128,0x2129,0x212a};
  for(unsigned byte=0;byte<256;byte++)for(unsigned source:{0x2134u,0x2135u,0x2136u,0x2138u,0x2139u,0x213au}){
   p.oamAddr=0;p.oamFlip=false;p.oam[0]=(std::uint8_t)byte;p.vramReadBuffer=(std::uint16_t)(byte*257);p.vmain=0;
   p.m7[0]=(std::uint16_t)byte;p.m7[1]=0x100;
   if(source==0x2135){p.m7[0]=(std::uint16_t)(byte<<8);}
   if(source==0x2136){p.m7[0]=(byte&0x80)?0xffff:0;}
   const auto observed=p.read((std::uint16_t)source);
   p.cgAddr=0;p.cgHigh=false;p.cgram[0]=0xef;p.read(0x213b); // PPU2 must not overwrite PPU1.
   for(auto port:writeOnly){p.regs[port-0x2100]=(std::uint8_t)~observed;check(p.read((std::uint16_t)port)==observed,"write-only port must return PPU1 MDR");}
   p.objRangeTimeFlags=(std::uint8_t)(byte&0xc0);
   const auto status=p.read(0x213e);check(status==(0x01|(byte&0xc0)|(observed&0x10)),"STAT77 must preserve PPU1 MDR bit4 and replace flag bits");
   check(p.read(0x2104)==status,"STAT77 updates PPU1 MDR");
  }
  for(bool enabled:{false,true})for(bool latched:{false,true})for(bool field:{false,true})for(bool pal:{false,true}){
   p.hvLatchEnabled=enabled;p.counterLatched=latched;p.stat78Field=field;p.stat78Pal=pal;p.hCounterHigh=p.vCounterHigh=true;
   const auto status=p.read(0x213f);
   check((status&0x40)==((!enabled||latched)?0x40:0),"STAT78 external latch disable forces bit6 high");
   check(p.counterLatched==(!enabled&&latched),"STAT78 preserves counter latch while WRIO bit7 low");
   check(!p.hCounterHigh&&!p.vCounterHigh,"STAT78 resets H/V read phases");
  }
 }
 std::cout<<"BUS_STATUS_V043666_VIDEO cases="<<cases<<" failures="<<failures<<"\n";return failures?1:0;
}
