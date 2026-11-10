// Forja65 REV132 — deterministic S-DSP stimulus shared by the golden test and the live
// differential oracle. No emulator code here: only register/ARAM stimulus and hashing.
#pragma once
#include <cstdint>
#include <random>
#include <vector>
struct SdspHash{std::uint64_t h=1469598103934665603ull;void add(std::uint64_t v,int bytes){for(int i=0;i<bytes;i++){h^=(v>>(8*i))&0xFFu;h*=1099511628211ull;}}};
struct SdspResult{std::uint64_t output,regs,aram;};
// Dsp must provide: write(reg,val), sample(int&l,int&r), readReg(reg), and expose its 64 KiB ARAM.
template<class Dsp> SdspResult sdspRunScenario(unsigned seed,unsigned samples,Dsp&dsp,std::uint8_t*aram){
  std::mt19937 g(seed*2654435761u);
  for(unsigned i=0;i<65536;i++)aram[i]=std::uint8_t(g());
  for(int s=0;s<16;s++){unsigned st=0x2000+s*0x500,lp=st+9*(g()%8);aram[0x100+s*4]=st&255;aram[0x101+s*4]=st>>8;aram[0x102+s*4]=lp&255;aram[0x103+s*4]=lp>>8;
    unsigned blocks=8+g()%100;for(unsigned b=0;b<blocks&&st+b*9+9<0x2000u+(s+1)*0x500u;b++)aram[st+b*9]=std::uint8_t(((g()%13)<<4)|((g()%4)<<2)|(b+1==blocks?(g()%2?3:1):0));}
  dsp.reload();
  auto W=[&](unsigned r,unsigned v){dsp.write(r&0x7F,v&0xFF);};
  for(unsigned r=0;r<128;r++)W(r,0);
  W(0x5D,0x01);W(0x6D,0x80+(g()%0x40));W(0x7D,g()%4);W(0x6C,g()%32);W(0x0C,0x60);W(0x1C,0x60);W(0x2C,g());W(0x3C,g());W(0x0D,g()%128-64);
  for(int k=0;k<8;k++)W((k<<4)|0xF,int(g()%64)-32);
  SdspHash out,regs,ram;
  for(unsigned n=0;n<samples;n++){
    const unsigned writes=g()%4==0?1+g()%4:0;
    for(unsigned w=0;w<writes;w++){const unsigned kind=g()%20,v=g()%8;
      switch(kind){
        case 0:case 1:W(0x4C,(1u<<v)|((g()%4==0)?g():0));break;
        case 2:W(0x5C,g()%3==0?(1u<<v):0);break;
        case 3:W(v*16+2,g());break;case 4:W(v*16+3,g()%0x40);break;
        case 5:W(v*16+4,g()%16);break;
        case 6:W(v*16+5,g());break;case 7:W(v*16+6,g());break;case 8:W(v*16+7,g());break;
        case 9:W(v*16+0,g());break;case 10:W(v*16+1,g());break;
        case 11:W(0x2D,g());break;case 12:W(0x3D,g()%5==0?g():0);break;case 13:W(0x4D,g());break;
        case 14:W(0x6C,(g()%10==0?0x80:0)|(g()%3==0?0x20:0)|(g()%32));break;
        case 15:W(0x7C,0);break;
        case 16:W(((g()%8)<<4)|0xF,int(g()%96)-48);break;
        case 17:W(0x0D,g());break;case 18:W(0x7D,g()%3);break;case 19:W(v*16+8+(g()%2),g());break;
      }}
    int l=0,r=0;dsp.sample(l,r);out.add(std::uint16_t(l),2);out.add(std::uint16_t(r),2);
    for(unsigned rr=0;rr<128;rr++)regs.add(dsp.readReg(rr),1);
  }
  for(unsigned i=0;i<65536;i++)ram.add(aram[i],1);
  return {out.h,regs.h,ram.h};
}
