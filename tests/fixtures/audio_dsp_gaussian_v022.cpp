#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <iostream>
#include <vector>
int main(){
  // Reference four-tap, saturating-even samples at fixed offsets.
  assert(SpcDsp::gaussianCoefficients.size()==512);
  assert(SpcDsp::gaussianCoefficients[0]==0);
  assert(SpcDsp::gaussianCoefficients[511]==1305);
  for(unsigned i=0;i<256;i++){
    int c=SpcDsp::gaussianCoefficients[255-i]
         +SpcDsp::gaussianCoefficients[511-i]
         +SpcDsp::gaussianCoefficients[256+i]
         +SpcDsp::gaussianCoefficients[i];
    assert(c>=2047 && c<=2049);
  }
  for(unsigned phase: {0u,256u,1024u,2048u,3072u,4095u}){
    const auto a=SpcDsp::interpolateGaussian(-8192,13000,-21000,12000,phase);
    assert((a&1)==0);
    assert(a>=-32768&&a<=32767);
  }
  // Reference oracle vectors computed independently from tabulated S-DSP coefficients.
  assert(SpcDsp::interpolateGaussian(0,0,0,0,0)==0);
  assert(SpcDsp::interpolateGaussian(-8192,13000,-21000,12000,0)==2968);
  assert(SpcDsp::interpolateGaussian(-8192,13000,-21000,12000,256)==2498);
  assert(SpcDsp::interpolateGaussian(-8192,13000,-21000,12000,1024)==314);
  assert(SpcDsp::interpolateGaussian(-8192,13000,-21000,12000,2048)==-3698);
  assert(SpcDsp::interpolateGaussian(-8192,13000,-21000,12000,3072)==-7326);
  assert(SpcDsp::interpolateGaussian(-8192,13000,-21000,12000,4095)==-8842);
  // Ensure decoded BRR transitions do not lose previous history or inject
  // a block-boundary zero, including END+LOOP.
  SpcDsp gauss,linear;std::vector<std::uint8_t> ram(65536);
  ram[0x100]=0;ram[0x101]=2;ram[0x102]=0;ram[0x103]=2;
  ram[0x200]=0xB3; // BRR range 11, END+LOOP
  for(int j=0;j<8;j++)ram[0x201+j]=(j&1)?0x77:0x37;
  const auto setup=[&](SpcDsp&d){
    d.writeReg(0x5d,1,ram);d.writeReg(0x02,0,ram);d.writeReg(0x03,0x10,ram);
    d.writeReg(0x00,100,ram);d.writeReg(0x01,100,ram);
    d.writeReg(0x0c,100,ram);d.writeReg(0x1c,100,ram);
    d.writeReg(0x05,0,ram);d.writeReg(0x07,0x7f,ram);d.writeReg(0x4c,1,ram);
  };
  setup(gauss);setup(linear);
  gauss.interpolation=SpcDsp::Interpolation::Gaussian;
  bool differs=false,heard=false,crossed=false;
  for(unsigned n=0;n<96;n++){
    const auto g=gauss.renderSample(ram),l=linear.renderSample(ram);
    if(g!=l)differs=true;
    if(g[0]||g[1])heard=true;
    if(gauss.voice[0].decodedAny && gauss.voice[0].blockPos==0 && n>0){
      crossed=true;
      assert(gauss.voice[0].previousTail[0]!=0 || gauss.voice[0].previousTail[1]!=0);
    }
  }
  assert(differs && heard && crossed);
  assert(gauss.voice[0].active && linear.voice[0].active);
  std::cout<<"Forja65/Tetris gaussian interpolation + BRR loop + linear fallback PASS\n";
}
