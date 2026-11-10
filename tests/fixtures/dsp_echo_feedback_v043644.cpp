#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstdint>
#include <vector>
#include <array>
#include <random>
#include <iostream>
#include <algorithm>
#include <cstdlib>

static int clamp16_reference(int n){return std::clamp(n,-32768,32767);}
static int arithmetic_div128(int n){return n>=0?n/128:-((-std::int64_t(n)+127)/128);}
static int read16(const std::vector<std::uint8_t>&ram,unsigned a){
  unsigned x=unsigned(ram[a&65535])|(unsigned(ram[(a+1)&65535])<<8);
  return x>=32768?int(x)-65536:int(x);
}
static void write16(std::vector<std::uint8_t>&ram,unsigned a,int x){
  unsigned v=unsigned(std::uint16_t(x));
  ram[a&65535]=std::uint8_t(v);ram[(a+1)&65535]=std::uint8_t(v>>8);
}
static void trial(int initialLeft,int initialRight,int feedback,int inputLeft,int inputRight,
    bool hardware,unsigned start,unsigned delay,unsigned &cases){
  SpcDsp d;d.hardwareEchoFir=hardware;d.echoConfigured=true;
  d.echoRamWritesAllowed=true;
  d.regs[0x4d]=1;
  d.regs[0x6d]=std::uint8_t(start);
  d.regs[0x7d]=std::uint8_t(delay);
  d.regs[0x0d]=std::uint8_t(feedback);
  // Only newest FIR tap contributes; 64/64 is an identity in hardware.
  d.regs[0x7f]=64;
  std::vector<std::uint8_t>ram(65536,0);
  d.writeReg(0x6c,0,ram);
  const unsigned addr=(start*256u)&0xffffu;
  write16(ram,addr,initialLeft);
  write16(ram,addr+2,initialRight);
  const auto wet=d.processEcho(ram,inputLeft,inputRight);
  const auto expected=[&](int input,int w){
    int p=w*feedback;
    int scaled=hardware?arithmetic_div128(p):p/128;
    int output=clamp16_reference(input+scaled);
    return hardware?(output&~1):output;
  };
  const int wantL=expected(inputLeft,wet[0]);
  const int wantR=expected(inputRight,wet[1]);
  if(read16(ram,addr)!=wantL||read16(ram,addr+2)!=wantR){
    std::cerr << "FAILED case=" << cases << " hw=" << hardware
       << " echo=" << wet[0] << ',' << wet[1] << " fb=" << feedback
       << " input=" << inputLeft << ',' << inputRight
       << " got=" << read16(ram,addr) << ',' << read16(ram,addr+2)
       << " expected=" << wantL << ',' << wantR << '\n';
    std::abort();
  }
  ++cases;
}
static void streamed(unsigned&cases){
  for(bool hardware:{true,false}){
    SpcDsp d;d.hardwareEchoFir=hardware;d.echoConfigured=true;
    d.echoRamWritesAllowed=true;d.regs[0x4d]=1;
    d.regs[0x6d]=0xff;d.regs[0x7d]=1;d.regs[0x7f]=64;
    std::vector<std::uint8_t>ram(65536,0);
    d.writeReg(0x6c,0,ram);
    std::mt19937 rng(0x44b1u);
    for(unsigned n=0;n<800;n++){
      const unsigned addr=(0xff00u+(n*4u)%2048u)&0xffffu;
      assert(addr==((unsigned(d.regs[0x6d])*256u+d.echoPosition)&0xffffu));
      const int left=int(rng()%65536u)-32768;
      const int right=int(rng()%65536u)-32768;
      const int inputL=int(rng()%65536u)-32768;
      const int inputR=int(rng()%65536u)-32768;
      const int fb=int(rng()%256u)-128;
      d.regs[0x0d]=std::uint8_t(fb);
      write16(ram,addr,left);write16(ram,addr+2,right);
      const auto wet=d.processEcho(ram,inputL,inputR);
      const auto oracle=[&](int input,int w){
        int p=w*fb;
        int v=clamp16_reference(input+(hardware?arithmetic_div128(p):p/128));
        return hardware?(v&~1):v;
      };
      if(read16(ram,addr)!=oracle(inputL,wet[0]) || read16(ram,addr+2)!=oracle(inputR,wet[1])){
        std::cerr << "stream case " << n << " hardware=" << hardware << '\n';
        std::abort();
      }
      ++cases;
    }
  }
}
int main(){
  unsigned cases=0;
  for(bool hardware:{true,false})
   for(int feedback:{-128,-127,-65,-64,-1,0,1,63,64,65,127})
    for(int sample:{-32768,-12345,-200,-4,-2,0,2,200,12345,32766,32767})
     for(int input:{-32768,-1,0,1,32766,32767})
       trial(sample,-sample-1,feedback,input,-input-1,hardware,0xff,0,cases);
  streamed(cases);
  std::cout<<"DSP_ECHO_FEEDBACK_V043644_PASS cases="<<cases
     <<" arithmetic_floor=1 clamp_before_even=1 legacy_preserved=1 stereo=1 wrap=1\n";
}
