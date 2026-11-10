#include "runtime.hpp"
#include <cassert>
#include <cstdint>
#include <iostream>

int main() {
  unsigned cases=0;
  for(unsigned v=0;v<256;++v) {
    SnesRuntime h;
    h.headless=true;
    auto &d=h.dma[0];
    h.hdmaLines[0]=7;
    h.hdmaEveryLine[0]=false;
    h.hdmaTransfer[0]=true;
    h.setDmaReg(0,0xA,(std::uint8_t)v);
    assert(d.ntrl==v);
    assert(h.hdmaLines[0]==((v&0x7Fu)?(v&0x7Fu):128u));
    assert(h.hdmaEveryLine[0]==(v==0u||v>0x80u));
    // The next transfer is decided by the previous entry, not the
    // newly-written repeat bit until the next HDMA boundary.
    assert(h.hdmaTransfer[0]);
    ++cases;
  }
  // Test an actual multi-scanline HDMA stream and an NLTR override.
  for(bool native: {false,true}) {
    SnesRuntime h;
    h.headless=true;
    h.nativeDmaEnabled=native;
    h.ppu.forceBlank=true;
    auto &d=h.dma[0];
    d.dmap=0; d.bbad=0x2c; d.a1b=0x7e; d.a1t=0x0100;
    h.ram[0x0100]=0x84; // four repeated transfers
    h.ram[0x0101]=0x11;
    h.ram[0x0102]=0x22;
    h.ram[0x0103]=0x33;
    h.ram[0x0104]=0x44;
    h.ram[0x0105]=0x00; // end
    h.io.hdmaen=1;h.beginFrame();h.advanceCpuMasterCycles(12u+(unsigned)(h.cpuMasterClock&7u));
    h.executeHdmaLine();
    assert(h.ppu.tm==0x11);
    assert(h.hdmaLines[0]==3);
    assert(d.ntrl==0x83);
    // CPU writes NLTR during the frame: wait two lines instead of three.
    h.write8(0x00430a,0x02);
    assert(h.hdmaLines[0]==2);
    assert(h.hdmaEveryLine[0]==false);
    assert(h.hdmaTransfer[0]);
    h.executeHdmaLine();
    assert(h.ppu.tm==0x22); // already-scheduled transfer still happens
    assert(h.hdmaLines[0]==1);
    assert(h.hdmaTransfer[0]==false);
    h.executeHdmaLine();
    assert(h.ppu.tm==0x22); // no-repeat on second remaining line
    assert(h.hdmaLines[0]==0x33); // next table byte is loaded at expiration
    assert(d.ntrl==0x33&&d.a2a==0x0104);
    assert(h.hdmaTransfer[0]);
    cases+=8;
  }
  // Non-active channels may be manually prepared before $420c reenable.
  for(unsigned ch=0;ch<8;++ch) {
    SnesRuntime h;
    h.setDmaReg(ch,10,0x81);
    assert(h.hdmaLines[ch]==1);
    assert(h.hdmaEveryLine[ch]);
    assert(h.dma[ch].ntrl==0x81);
    ++cases;
  }
  std::cout << "HDMA_NLTR_OVERRIDE_V043661_PASS cases=" << cases << "\n";
}
