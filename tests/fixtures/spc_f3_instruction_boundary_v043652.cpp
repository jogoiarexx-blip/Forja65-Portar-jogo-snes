#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>

static void init(ApuBridge& a, unsigned nopCount, unsigned page, std::uint8_t dspAddr=0x6c, std::uint8_t oldFlg=0, std::uint8_t nextFlg=0x20) {
  a.setNativeDsp(true);
  a.dsp.hardwareEchoFir=true;
  a.spc.control=0; // run code from RAM, not the IPL overlay
  a.spc.pc=0x300;
  a.spc.dspAddr=dspAddr;
  a.dsp.writeReg(0x6d, std::uint8_t(page),a.spc.ram);
  a.dsp.writeReg(0x7d,0,a.spc.ram);
  a.dsp.writeReg(0x4d,0,a.spc.ram);
  a.dsp.writeReg(0x0d,0,a.spc.ram);
  a.dsp.writeReg(0x6c,oldFlg,a.spc.ram);
  SpcDsp::writeSigned16(a.spc.ram,page<<8,8000);
  SpcDsp::writeSigned16(a.spc.ram,(page<<8)+2,-8000);
  for(unsigned i=0;i<nopCount;i++)a.spc.ram[0x300+i]=0x00;
  a.spc.ram[0x300+nopCount]=0x8f; // MOV $F3,#$20, 5 cycles
  a.spc.ram[0x301+nopCount]=nextFlg;
  a.spc.ram[0x302+nopCount]=0xf3;
  a.spc.ram[0x303+nopCount]=0xff; // STOP, 2 cycles
}
static std::uint64_t completion(unsigned nopCount){
  const auto cycles=2u*nopCount+5u;
  return (std::uint64_t(cycles)*21477272ull+1024000ull-1ull)/1024000ull;
}
int main(){
  unsigned cases=0;
  for(unsigned nop=0;nop<=13;nop++)for(unsigned page:{0x11u,0x27u,0x39u,0x4fu,0x6au,0x7fu,0xa5u,0xe8u}){
    ApuBridge a;init(a,nop,page);
    a.tickMasterCycles(672);
    assert(a.spcFlgAutoScheduled==1&&a.spcFlgAutoRejected==0);
    assert(a.timedEchoProtection.empty());
    assert(a.dspNativeSamples==1);
    const bool protectedLeft=completion(nop)<=588u;
    const bool protectedRight=completion(nop)<=609u;
    assert(SpcDsp::readSigned16(a.spc.ram,page<<8)==(protectedLeft?8000:0));
    assert(SpcDsp::readSigned16(a.spc.ram,(page<<8)+2)==(protectedRight?-8000:0));
    ++cases;
  }
  // Reverse transition: start with protected RAM and unlock after MOV $F3,#$00.
  for(unsigned nop=0;nop<=13;nop++)for(unsigned page:{0x12u,0x28u,0x56u,0x83u}){
    ApuBridge a;init(a,nop,page,0x6c,0x20,0x00);
    a.tickMasterCycles(672);
    assert(a.spcFlgAutoScheduled==1 && a.spcFlgAutoRejected==0);
    const bool unprotectedLeft=completion(nop)<=588u;
    const bool unprotectedRight=completion(nop)<=609u;
    assert(SpcDsp::readSigned16(a.spc.ram,page<<8)==(unprotectedLeft?0:8000));
    assert(SpcDsp::readSigned16(a.spc.ram,(page<<8)+2)==(unprotectedRight?0:-8000));
    ++cases;
  }
  // Disabled opt-in and uninterleaved mode: never manufacture timestamps.
  for(unsigned which=0;which<2;which++){
    ApuBridge a;init(a,12,0x23);
    if(which==0)a.autoSpcFlgEcho=false;
    else a.interleaveSpcDsp=false;
    a.tickMasterCycles(672);
    assert(a.spcFlgAutoScheduled==0 && !a.timedEchoEnabled);
    ++cases;
  }
  // Identical output when the host clocks the exact same timeline in smaller chunks.
  for(unsigned nop=0;nop<=13;nop++){
    ApuBridge bulk,chunk;init(bulk,nop,0x45);init(chunk,nop,0x45);
    bulk.tickMasterCycles(672);
    for(unsigned i=0;i<672;i++)chunk.tickMasterCycles(1);
    assert(bulk.spc.ram==chunk.spc.ram);
    assert(bulk.spcFlgAutoScheduled==1 && chunk.spcFlgAutoScheduled==1);
    assert(bulk.dspNativeSamples==chunk.dspNativeSamples);
    ++cases;
  }
  // Disabled DSP address: do not auto-schedule, including when byte 7 is set.
  for(unsigned addr:{0x7fu,0xecu}){
    ApuBridge a;init(a,0,0x34,std::uint8_t(addr));
    a.tickMasterCycles(672);
    assert(a.spcFlgAutoScheduled==0 && !a.timedEchoEnabled);
    ++cases;
  }
  // Direct debug-side writes must never guess their timing.
  {
    ApuBridge a;init(a,0,0x32);
    a.spcWrite(0xf3,0x20);
    assert(a.spcFlgAutoScheduled==0&&!a.timedEchoEnabled);
    ++cases;
  }
  std::cout<<"SPC_F3_INSTRUCTION_BOUNDARY_V043652_PASS cases="<<cases<<"\n";
}
