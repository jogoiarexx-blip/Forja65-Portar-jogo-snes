// Forja65 side of the S-DSP differential: same stimulus, hashes compared with golden/oracle lines.
#include "runtime.hpp"
#include "sdsp_scenarios_v0436132.hpp"
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <memory>
#include <string>
struct ForjaDsp{std::unique_ptr<SpcDsp> d;std::vector<std::uint8_t> ram=std::vector<std::uint8_t>(65536);bool pipeline=true;
  void reload(){d=std::make_unique<SpcDsp>();d->interpolation=SpcDsp::Interpolation::Gaussian;d->hardwareBrrDecode=d->hardwareEchoFir=d->hardwareEnvelopeTiming=d->hardwareKeyTiming=d->hardwareNoiseTiming=d->hardwareVolumeScaling=true;d->hardwareEnvelopeOutput=true;d->echoRamWritesAllowed=true;d->cycleExactPipeline=pipeline;}
  void write(unsigned r,unsigned v){d->writeReg(std::uint8_t(r),std::uint8_t(v),ram);}void sample(int&l,int&r){auto q=d->renderSample(ram);l=q[0];r=q[1];}
  unsigned readReg(unsigned r){return d->readReg(std::uint8_t(r));}};
int main(int argc,char**argv){
  if(argc<2){std::fprintf(stderr,"uso: sdsp_forja golden.txt [legacy]\n");return 2;}
  ForjaDsp f;f.pipeline=!(argc>2&&std::string(argv[2])=="legacy");std::ifstream in(argv[1]);
  unsigned seed,samples,total=0,outOk=0,regOk=0,ramOk=0;std::string ho,hr,ha;
  while(in>>seed>>samples>>ho>>hr>>ha){
    auto r=sdspRunScenario(seed,samples,f,f.ram.data());char b[3][17];
    std::snprintf(b[0],17,"%016llx",(unsigned long long)r.output);std::snprintf(b[1],17,"%016llx",(unsigned long long)r.regs);std::snprintf(b[2],17,"%016llx",(unsigned long long)r.aram);
    total++;outOk+=ho==b[0];regOk+=hr==b[1];ramOk+=ha==b[2];}
  std::printf("SDSP_GOLDEN mode=%s scenarios=%u output_exact=%u registers_exact=%u aram_exact=%u\n",f.pipeline?"cycle_pipeline":"previous_sample_model",total,outOk,regOk,ramOk);
  return (total&&outOk==total&&regOk==total&&ramOk==total)?0:1;}
