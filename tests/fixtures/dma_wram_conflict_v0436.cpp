#include "runtime.hpp"
#include <iostream>
#include <stdexcept>

static void check(bool ok,const char* why){if(!ok)throw std::runtime_error(why);}
static void configure(SnesRuntime& h,bool native){
  h.headless=true;h.nativeDmaEnabled=native;h.ppu.forceBlank=true;
}
int main(int argc,char**argv){try{
  const bool reverse=argc>1&&std::string(argv[1])=="reverse";
  unsigned vectors=0;
  for(bool native:{false,true})for(unsigned bank:{0x7eu,0x7fu,0x00u,0x3fu,0x80u,0xbfu})
  for(unsigned mode=0;mode<8;mode++){
    SnesRuntime h;configure(h,native);auto&d=h.dma[0];
    const unsigned offset=bank==0x7f?0x10100u:0x100u;
    h.ram[offset]=0x5a;h.ram[0x400]=0xa5;h.io.wramPortAddr=0x400;
    d.a1b=bank;d.a1t=0x100;d.bbad=0x80;d.das=1;d.dmap=mode|(reverse?0x80:0);
    // Establish the last CPU data-bus byte without reading the WRAM port.
    h.ram[0x700]=0x3c;check(h.read(0x7e0700)==0x3c,"bus seed");
    h.executeDma(1);
    check(h.ram[0x400]==0xa5,"WRAM port was written during conflicting DMA");
    check(h.io.wramPortAddr==0x400,"WMADD advanced during conflicting DMA");
    check(h.ram[offset]==(reverse?0:0x5a),"reverse collision did not drive zero");
    check(d.a1t==0x101&&d.das==0&&h.io.mdmaen==0,"DMA registers did not finish");
    check(h.dmaStallMasterCycles==24,"conflicting DMA must still consume cycles");
    check(h.hwUsage.dmaBytes==1,"DMA byte count");vectors++;
  }
  if(!reverse){
    for(bool native:{false,true})for(unsigned flags:{0u,8u,16u}){
      SnesRuntime h;configure(h,native);auto&d=h.dma[0];
      h.io.wramPortAddr=0x400;h.ram[0x400]=0xa5;
      d.a1b=0x7e;d.a1t=flags==16u?0u:0xfffeu;d.bbad=0x80;d.das=4;d.dmap=flags;
      h.executeDma(1);
      check(h.ram[0x400]==0xa5&&h.io.wramPortAddr==0x400,"wrap/fixed/decrement collision");
      check(d.a1t==(flags==8u?0xfffeu:flags==16u?0xfffcu:2u),"DMA A-bus wrap");vectors++;
    }
    for(bool native:{false,true}){
      SnesRuntime h;configure(h,native);auto&d=h.dma[0];
      h.io.wramPortAddr=0x400;h.ram[0x400]=0xa5;
      d.a1b=0x7e;d.bbad=0x80;d.das=0;h.executeDma(1);
      check(h.ram[0x400]==0xa5&&h.io.wramPortAddr==0x400,"65536-byte collision");
      check(d.a1t==0&&d.das==0&&h.dmaStallMasterCycles==16u+65536u*8u,"zero length DMA");vectors++;
      // Ordinary ROM -> WRAM and CPU accesses must retain their effects.
      SnesRuntime valid;configure(valid,native);valid.cart.assign(0x8000,0x66);
      valid.io.wramPortAddr=0x1ffff;auto&v=valid.dma[0];v.a1t=0x8000;v.bbad=0x80;v.das=2;
      valid.executeDma(1);
      check(valid.ram[0x1ffff]==0x66&&valid.ram[0]==0x66&&valid.io.wramPortAddr==1,"valid ROM DMA blocked");
      valid.write8(0x2180,0x22);check(valid.read(0x7e0001)==0x22&&valid.io.wramPortAddr==2,"CPU WRAM port blocked");vectors++;
      // The $0000-$1fff mirror ends inside this transfer: only the first two bytes conflict.
      SnesRuntime edge;configure(edge,native);edge.ram[0x1ffe]=0x11;edge.ram[0x1fff]=0x22;
      edge.io.wramPortAddr=0x400;edge.ram[0x400]=0xa5;
      auto&e=edge.dma[0];e.a1t=0x1ffe;e.bbad=0x80;e.das=4;edge.executeDma(1);
      check(edge.io.wramPortAddr==0x402,"mirror conflict was not checked per byte");vectors++;
      // HDMA uses the same WRAM chip and must not copy WRAM into itself.
      for(bool indirect:{false,true}){
        SnesRuntime hd;configure(hd,native);hd.frameTimingActive=true;hd.currentMasterCycle=SnesRuntime::HDMA_START_MC;
        auto&q=hd.dma[0];q.a1b=0x7e;q.a2a=0x100;
        q.dmap=indirect?0x40:0;q.dasb=0x7e;q.das=0x100;q.bbad=0x80;
        hd.ram[0x100]=0x5a;hd.ram[0x400]=0xa5;hd.io.wramPortAddr=0x400;
        hd.hdmaActive=1;hd.hdmaLines[0]=1;hd.hdmaTransfer[0]=true;hd.executeHdmaLine();
        check(hd.ram[0x400]==0xa5&&hd.io.wramPortAddr==0x400,"HDMA WRAM collision");
        check((indirect?q.das:q.a2a)==0x101,"HDMA payload pointer");vectors++;
      }
    }
  }else{
    for(bool native:{false,true}){
      SnesRuntime h;configure(h,native);h.sram.assign(16,0xff);h.io.wramPortAddr=0x400;h.ram[0x400]=0x77;
      auto&d=h.dma[0];d.a1b=0x70;d.bbad=0x80;d.dmap=0x80;d.das=1;h.executeDma(1);
      check(h.sram[0]==0x77&&h.io.wramPortAddr==0x401,"valid reverse DMA blocked");
      h.sramDirty=false;vectors++;
      for(bool indirect:{false,true}){
        SnesRuntime hd;configure(hd,native);hd.frameTimingActive=true;hd.currentMasterCycle=SnesRuntime::HDMA_START_MC;
        auto&q=hd.dma[0];q.a1b=0x7e;q.a2a=0x100;q.dmap=0x80|(indirect?0x40:0);
        q.dasb=0x7e;q.das=0x100;q.bbad=0x80;hd.ram[0x700]=0x3c;hd.read(0x7e0700);
        hd.ram[0x100]=0x5a;hd.ram[0x400]=0xa5;hd.io.wramPortAddr=0x400;
        hd.hdmaActive=1;hd.hdmaLines[0]=1;hd.hdmaTransfer[0]=true;hd.executeHdmaLine();
        check(hd.ram[0x100]==0&&hd.ram[0x400]==0xa5&&hd.io.wramPortAddr==0x400,"reverse HDMA collision");vectors++;
      }
    }
  }
  std::cout<<"DMA_WRAM_CONFLICT_V0436_PASS direction="<<(reverse?"reverse":"forward")<<" vectors="<<vectors<<'\n';
  return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
