// Live differential: blargg SPC_DSP (fetched from Snes9x by fetch-oracle script; LGPL; NOT shipped).
#include "snes9x_stub.h"
#include "SPC_DSP.h"
#include "sdsp_scenarios_v0436132.hpp"
#include <cstdio>
struct OracleDsp{SPC_DSP d;Resampler res;std::uint8_t*ram;void reload(){d.init(ram);d.reset();d.set_output(&res);res.out.clear();}
  void write(unsigned r,unsigned v){d.write(int(r),int(v));}void sample(int&l,int&r){d.run(32);l=res.out[res.out.size()-2];r=res.out.back();}
  unsigned readReg(unsigned r){return unsigned(d.read(int(r)));}};
int main(int argc,char**argv){static std::uint8_t ram[65536];OracleDsp o;o.ram=ram;
  const unsigned seeds=argc>1?atoi(argv[1]):24,samples=argc>2?atoi(argv[2]):4000;
  for(unsigned s=1;s<=seeds;s++){auto r=sdspRunScenario(s,samples,o,ram);std::printf("%u %u %016llx %016llx %016llx\n",s,samples,(unsigned long long)r.output,(unsigned long long)r.regs,(unsigned long long)r.aram);}}
