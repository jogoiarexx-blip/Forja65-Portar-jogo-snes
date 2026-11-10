#include "runtime.hpp"
#include <iostream>
#include <fstream>
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
int main(int argc,char**argv){
  if(argc!=2)return 2;
  std::ifstream in(argv[1]); if(!in)return 2;
  // Exercise the actual generated-port environment configuration, including
  // all previously available audio compatibility switches.
  {
    SnesRuntime runtime("assets/cart-data.bin",MapperKind::LoROM,0,0,0,CartChip::None,"save.srm",1,true);
    const bool legacy=SnesRuntime::envText("FORJA65_DSP_BRR")=="legacy";
    assert(runtime.apu.dsp.hardwareBrrDecode==!legacy);
    assert(runtime.apu.dsp.hardwareKeyTiming==(SnesRuntime::envText("FORJA65_DSP_KEYS")!="legacy"));
    assert(runtime.apu.dsp.hardwareEnvelopeTiming==(SnesRuntime::envText("FORJA65_DSP_ENVELOPE")!="legacy"));
    assert((runtime.apu.dsp.interpolation==SpcDsp::Interpolation::Linear)==(SnesRuntime::envText("FORJA65_DSP_INTERPOLATION")=="linear"));
  }
  std::vector<std::uint8_t> ram(65536);
  SpcDsp dsp;
  unsigned header,records=0;int p,o;std::uint64_t samples=0;
  while(in>>header>>p>>o){
    unsigned bytes[16];int expected[32];
    for(auto&b:bytes)if(!(in>>b))return 2;
    for(auto&e:expected)if(!(in>>e))return 2;
    auto&v=dsp.voice[0];v=SpcDsp::Voice{};v.hist1=p/2;v.hist2=o/2;
    // Alternate placement at the RAM wrap boundary to test BRR bus wrapping.
    const unsigned start=(records&1)?0xFFFCu:0x300u;v.addr=start;
    for(unsigned block=0;block<2;block++){
      const unsigned addr=(start+9*block)&0xFFFF;
      ram[addr]=header;
      for(unsigned j=0;j<8;j++)ram[(addr+1+j)&0xFFFF]=bytes[block*8+j];
    }
    for(unsigned block=0;block<2;block++){
      dsp.decodeBlock(v,ram);
      if(block)for(unsigned j=0;j<3;j++)assert(v.previousTail[j]==expected[13+j]);
      for(unsigned j=0;j<16;j++){
        const int got=v.decoded[j],want=expected[block*16+j];
        if(got!=want){
          std::cerr<<"{\"record\":"<<records<<",\"header\":"<<header
            <<",\"history_pcm\":["<<p<<','<<o<<"],\"block\":"<<block
            <<",\"sample\":"<<j<<",\"expected\":"<<want<<",\"actual\":"<<got<<"}\n";
          return 1;
        }
        ++samples;
      }
      assert(v.hist1*2==expected[block*16+15]);
      assert(v.hist2*2==expected[block*16+14]);
      assert(v.addr==((start+9*(block+1))&0xFFFF));
    }
    ++records;
  }
  assert(records==50178 && samples==1605696);
  // Legacy BRR stays independently selectable for old diagnostic captures.
  SpcDsp legacy;legacy.hardwareBrrDecode=false;
  auto&v=legacy.voice[0];v.addr=0x300;ram[0x300]=0;ram[0x301]=0xF0;
  legacy.decodeBlock(v,ram);assert(v.decoded[0]==0);
  v=SpcDsp::Voice{};v.addr=0x300;v.hist1=v.hist2=16383;
  ram[0x300]=0xC4;ram[0x301]=0x77;
  legacy.decodeBlock(v,ram);assert(v.decoded[0]==32766);
  std::cout<<"BRR_REFERENCE_PASS records="<<records<<" samples="<<samples<<"\n";
}
