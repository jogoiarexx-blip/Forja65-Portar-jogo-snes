#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>

static unsigned ringBytes(unsigned edl){ return edl ? edl * 2048u : 4u; }
static void checkRing(unsigned oldEdl, unsigned newEdl, unsigned &cases){
  std::vector<std::uint8_t> ram(65536,0);
  SpcDsp dsp;
  dsp.hardwareEchoFir=true;
  dsp.echoRamWritesAllowed=false;
  dsp.writeReg(0x4d,1,ram);
  dsp.writeReg(0x6d,0x20,ram);
  dsp.writeReg(0x7d,std::uint8_t(oldEdl),ram);
  dsp.processEcho(ram,0,0);
  const unsigned oldBytes=ringBytes(oldEdl);
  assert(dsp.echoActiveBytes==oldBytes);
  assert(dsp.echoPosition==(oldBytes==4?0u:4u));
  dsp.echoHistory[6]={234,-456};
  auto before=dsp.echoPosition;
  auto historyIndex=dsp.echoHistoryPos;
  dsp.writeReg(0x6d,0x40,ram);
  dsp.writeReg(0x7d,std::uint8_t(newEdl),ram);
  // Reprogramming echo registers must not rewind the ring or erase FIR taps.
  assert(dsp.echoPosition==before);
  assert(dsp.echoHistoryPos==historyIndex);
  assert(dsp.echoHistory[6][0]==234 && dsp.echoHistory[6][1]==-456);
  if(oldBytes!=4){
    // After an ESA write the current frame still uses the previously
    // sampled page, while the ring offset and FIR history continue.
    const unsigned oldAddr=(0x2000u+before)&0xffffu;
    ram[oldAddr]=0x00;ram[(oldAddr+1)&65535]=0x20;
    ram[(oldAddr+2)&65535]=0x00;ram[(oldAddr+3)&65535]=0xe0;
    const unsigned nextAddr=(0x4000u+before+4u)&0xffffu;
    ram[nextAddr]=0x00;ram[(nextAddr+1)&65535]=0x30;
    ram[(nextAddr+2)&65535]=0x00;ram[(nextAddr+3)&65535]=0xd0;
    dsp.processEcho(ram,0,0);
    unsigned accessedIndex=(dsp.echoHistoryPos+7u)&7u;
    assert(dsp.echoHistory[accessedIndex][0]==4096);
    assert(dsp.echoHistory[accessedIndex][1]==-4096);
    assert(dsp.echoActiveBytes==oldBytes);
    assert(dsp.echoPosition==((before+4u)%oldBytes));
    ++cases;
    // On the following sample the new ESA is active, but the original
    // EDL remains in effect until its ring actually wraps.
    dsp.processEcho(ram,0,0);
    accessedIndex=(dsp.echoHistoryPos+7u)&7u;
    assert(dsp.echoHistory[accessedIndex][0]==6144);
    assert(dsp.echoHistory[accessedIndex][1]==-6144);
    assert(dsp.echoActiveBytes==oldBytes);
    ++cases;
    unsigned ticks=2;
    while(dsp.echoPosition!=0){
      assert(dsp.echoActiveBytes==oldBytes);
      dsp.processEcho(ram,0,0);
      assert(++ticks<=oldBytes/4u);
    }
  }
  assert(dsp.echoPosition==0);
  dsp.processEcho(ram,0,0);
  assert(dsp.echoActiveBytes==ringBytes(newEdl));
  assert(dsp.echoPosition==(newEdl==0?0u:4u));
  ++cases;
}
int main(){
  unsigned cases=0;
  for(unsigned oldEdl : {0u,1u,2u,3u,15u})
    for(unsigned newEdl : {0u,1u,2u,5u})
      checkRing(oldEdl,newEdl,cases);
  // Historic mode intentionally retains the legacy restart/clear behavior.
  {
    std::vector<std::uint8_t> ram(65536,0);
    SpcDsp dsp;
    dsp.hardwareEchoFir=false;
    dsp.writeReg(0x6d,0x20,ram);
    dsp.writeReg(0x7d,1,ram);
    dsp.processEcho(ram,0,0);
    dsp.echoHistory[6]={234,-456};
    dsp.writeReg(0x7d,2,ram);
    assert(dsp.echoPosition==0);
    assert(dsp.echoHistory[6][0]==0 && dsp.echoHistory[6][1]==0);
    ++cases;
  }
  // Rendering 100 frames at once or in 13+87 frames produces identical PCM and DSP state.
  {
    std::vector<std::uint8_t> ramA(65536,0),ramB(65536,0);
    SpcDsp a,b;
    a.hardwareEchoFir=b.hardwareEchoFir=true;
    a.echoRamWritesAllowed=b.echoRamWritesAllowed=false;
    a.writeReg(0x6d,0x40,ramA);a.writeReg(0x7d,2,ramA);
    b.writeReg(0x6d,0x40,ramB);b.writeReg(0x7d,2,ramB);
    auto full=a.render(ramA,100);
    auto p=b.render(ramB,13);auto q=b.render(ramB,87);
    p.insert(p.end(),q.begin(),q.end());
    assert(p==full);
    assert(a.echoPosition==b.echoPosition && a.echoHistoryPos==b.echoHistoryPos);
    ++cases;
  }
  std::cout<<"DSP_ECHO_DELAY_LATCH_V043646_PASS cases="<<cases<<"\n";
}
