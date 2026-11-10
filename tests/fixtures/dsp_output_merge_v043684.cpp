#include "runtime.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <iostream>
static int sample(SpcDsp& d){
  std::vector<std::uint8_t> ram(65536);
  d.interpolation=SpcDsp::Interpolation::Linear;
  d.voice[0].active=true;d.voice[0].blockPos=0;d.voice[0].decoded[0]=-12345;
  d.regs[7]=97;return d.nextSample(0,ram);
}
static void env(const char* key,const char*value){
#ifdef _WIN32
  _putenv_s(key,value);
#else
  setenv(key,value,1);
#endif
}
int main(int argc,char**argv){
 assert(argc==2);unsigned checks=0;
 const int legacy=-12345*(97*16)/2047;
 const int hardware=SpcDsp::applyEnvelopeHardware(-12345,97*16);
 assert(legacy!=hardware);
 for(bool volume:{false,true}){
   SpcDsp inherited;inherited.hardwareVolumeScaling=volume;
   assert(!inherited.hardwareEnvelopeOutput.has_value());
   assert(sample(inherited)==(volume?hardware:legacy));++checks;
   for(bool output:{false,true}){
     SpcDsp explicitMode;explicitMode.hardwareVolumeScaling=volume;
     explicitMode.hardwareEnvelopeOutput=output;
     assert(sample(explicitMode)==(output?hardware:legacy));++checks;
     env("FORJA65_DSP_VOLUMES",volume?"hardware":"legacy");
     env("FORJA65_DSP_ENV_OUTPUT",output?"hardware":"legacy");
     SnesRuntime rt(argv[1],MapperKind::LoROM,0,0,0,CartChip::None,"",1,true);
     assert(rt.apu.dsp.hardwareVolumeScaling==volume);
     assert(rt.apu.dsp.hardwareEnvelopeOutput.has_value());
     assert(rt.apu.dsp.hardwareEnvelopeOutput.value()==output);
     assert(sample(rt.apu.dsp)==(output?hardware:legacy));++checks;
   }
 }
 std::cout<<"DSP_OUTPUT_MERGE_V043684_PASS checks="<<checks<<" independent_flags=4 inherited_modes=2\n";
}
