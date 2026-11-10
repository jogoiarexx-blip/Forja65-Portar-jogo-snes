#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>

// The video game drives all of these through the normal SNES runtime, not a mocked counter.
static void runLine(SnesRuntime& hw) {
    // Position the synthetic scanline in HBlank, where HDMA is allowed to run.
    hw.frameTimingActive=true;
    hw.currentScanline=0;
    hw.currentMasterCycle=SnesRuntime::HDMA_START_MC;
    hw.hdmaExecutedThisLine=true;
    hw.executeHdmaLine();
}
static void prepare(SnesRuntime&hw,std::uint8_t count) {
    hw.hdmaActive=1;
    hw.hdmaEnded=0;
    hw.dma[0]={};
    auto&d=hw.dma[0];
    d.a1b=0x7E;d.a1t=0x0100;d.a2a=0x0100;d.bbad=0x00;d.dmap=0;
    hw.hdmaLines[0]=0;hw.hdmaEveryLine[0]=false;hw.hdmaTransfer[0]=false;
    hw.ram[0x100]=count;hw.ram[0x101]=0x0F;hw.ram[0x102]=0; // brightness command, followed by terminator
    hw.ppu.write(0x2100,0x80); // forced blank = brightness disabled
    hw.io.hdmaen=1;hw.beginFrame();hw.advanceCpuMasterCycles(12u+(unsigned)(hw.cpuMasterClock&7u));
}
static void descriptor80NonRepeating(SnesRuntime&hw) {
    prepare(hw,0x80);
    runLine(hw);
    assert(hw.ppu.inidisp==0x0F);
    assert(hw.hdmaLines[0]==127 && !hw.hdmaEveryLine[0]);
    assert(hw.dma[0].a2a==0x0102);
    for(int i=0;i<127;++i){
      hw.ppu.write(0x2100,0x80);
      runLine(hw);
      assert(hw.ppu.inidisp==0x80); // no unexpected repeat upload
    }
    assert(hw.hdmaLines[0]==0 && hw.dma[0].a2a==0x0103 && hw.hdmaActive==0);
    runLine(hw); // already ended by the final counted line
    assert(hw.hdmaActive==0 && hw.hdmaEnded==1 && hw.dma[0].a2a==0x0103);
}
static void descriptor82Repeating(SnesRuntime&hw) {
    prepare(hw,0x82);
    hw.ram[0x102]=0x04;
    hw.ram[0x103]=0;
    runLine(hw);
    assert(hw.ppu.inidisp==0x0F && hw.hdmaLines[0]==1 && hw.hdmaEveryLine[0]);
    hw.ppu.write(0x2100,0x80);
    runLine(hw);
    assert(hw.ppu.inidisp==0x04 && hw.hdmaLines[0]==0);
    hw.ppu.write(0x2100,0x80);
    runLine(hw);
    assert(hw.hdmaActive==0 && hw.hdmaEnded==1);
}
static void preserveMidframeState(SnesRuntime&hw) {
    hw.startHdmaFrame(0);
    auto&d=hw.dma[2];
    d.a1t=0x8123;d.a2a=0xA123;d.ntrl=0x87;
    hw.hdmaInitialized[2]=false;
    hw.setHdmaEnable(4);
    assert(hw.hdmaActive==4 && hw.io.hdmaen==4);
    assert(d.a2a==0xA123 && d.ntrl==0x87);
    // VBlank/frame start should prime channel from the table as normal.
    d.a1b=0x7e;hw.ram[0x8123]=0x82;
    hw.startHdmaFrame(4);
    assert(d.a2a==0xA123 && d.ntrl==0x87); // no early reset before setup
    hw.currentScanline=0;hw.currentMasterCycle=0;
    hw.advanceCpuMasterCycles(12u+(unsigned)(hw.cpuMasterClock&7u));
    assert(d.a2a==0x8124 && d.ntrl==0x82);
}
int main(){
    SnesRuntime hw;
    descriptor80NonRepeating(hw);
    descriptor82Repeating(hw);
    preserveMidframeState(hw);
    std::cout<<"HDMA_DESCRIPTOR_SMOKE_OK count80 count82 midframe frameinit\n";
}
