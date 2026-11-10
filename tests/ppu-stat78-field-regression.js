'use strict';
require('./fixtures/run_spc_probe_v0431')('ppu-stat78-field', String.raw`
int main(){
 SnesRuntime hw;hw.headless=true;hw.regionCode=1;hw.ppu.setini=0;
 hw.beginFrame();
 assert((hw.ppuPortRead(0x213f)&0x90u)==0u);
 hw.endVblank();hw.beginFrame();
 assert((hw.ppuPortRead(0x213f)&0x90u)==0x80u);
 hw.endVblank();hw.beginFrame();
 assert((hw.ppuPortRead(0x213f)&0x80u)==0u);
 hw.regionCode=2;hw.ppu.setini=1;hw.endVblank();hw.beginFrame();
 assert((hw.ppuPortRead(0x213f)&0x90u)==0x90u);
 hw.endVblank();hw.beginFrame();
 assert((hw.ppuPortRead(0x213f)&0x90u)==0x10u);
 hw.ppu.hCounter=0x42;hw.ppu.vCounter=0x13;hw.ppuPortRead(0x2137);
 assert((hw.ppuPortRead(0x213f)&0x50u)==0x50u);
 assert((hw.ppuPortRead(0x213f)&0x50u)==0x10u);
 std::cout<<"FORJA65_PPU_STAT78_FIELD_PASS\n";
}
`);
