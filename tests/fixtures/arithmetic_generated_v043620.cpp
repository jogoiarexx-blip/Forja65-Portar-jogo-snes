#include "generated.hpp"
#include "ares_arithmetic_reference_v043620.hpp"
#include <memory>
#include <fstream>
#include <iostream>
int main(){unsigned cases=0,failures=0;std::ofstream out("generated-arithmetic-results.json");out<<"{\"cases\":[";
 for(unsigned pc:{0x8100u,0x8140u,0x8180u,0x81c0u})for(bool emu:{false,true})for(bool decimal:{false,true}){
  bool wide=pc==0x8140||pc==0x81c0,sub=pc>=0x8180;if(wide&&emu)continue;
  auto h=std::make_unique<SnesRuntime>();h->loadCart("assets/cart-data.bin");CpuState c;c.e=emu;c.m8=!wide;c.x8=true;c.decimalMode=decimal;c.a=sub?(wide?0x8000:0xa580):(wide?0:0xa500);c.c=!sub;c.s=0x1a0;c.x=0x12;c.y=0x34;c.d=0x5678;
  upstream_ares_reference::AresArithmeticReference ref;ref.A.w=c.a;ref.CF=c.c;ref.DF=decimal;
  unsigned operand=sub?1:wide?0x7999:0x79;
  if(sub){if(wide)ref.algorithmSBC16(operand);else ref.algorithmSBC8(std::uint8_t(operand));}else{if(wide)ref.algorithmADC16(operand);else ref.algorithmADC8(std::uint8_t(operand));}
  unsigned arithmetic=ref.A.w,marker=ref.VF?0x22:0x11,store=pc==0x8100?0x20:pc==0x8140?0x40:pc==0x8180?0x60:0x80;
  unsigned expectedA=wide?marker:((arithmetic&0xff00)|marker);forja65_dispatch(c,*h,pc,0);
  bool ok=c.a==expectedA&&h->ram[store]==(arithmetic&255)&&(!wide||h->ram[store+1]==(arithmetic>>8))&&c.v==ref.VF&&c.c==ref.CF&&!c.z&&!c.n&&h->stopped&&h->lastInstructionPc==pc+(wide?(ref.VF?15:11):(ref.VF?12:9))&&c.s==0x1a0&&c.d==0x5678&&c.x==0x12&&c.y==0x34&&c.e==emu&&c.m8==!wide&&c.x8&&c.decimalMode==decimal&&c.i&&c.db==0&&c.pb==0&&h->nativeReturns.empty();
  if(cases++)out<<',';out<<"{\"pc\":"<<pc<<",\"e\":"<<(emu?"true":"false")<<",\"decimal\":"<<(decimal?"true":"false")<<",\"passed\":"<<(ok?"true":"false")<<",\"arithmetic_expected\":"<<arithmetic<<",\"marker_expected\":"<<marker<<",\"a_actual\":"<<c.a<<",\"v_expected\":"<<(ref.VF?"true":"false")<<",\"v_actual\":"<<(c.v?"true":"false")<<"}";
  if(!ok){failures++;std::cerr<<"ARITHMETIC_GENERATED_DIFF pc="<<std::hex<<pc<<" E="<<emu<<" decimal="<<decimal<<" expectedA="<<expectedA<<" actualA="<<c.a<<" V="<<c.v<<" expectedV="<<ref.VF<<std::dec<<'\n';}
 }
 out<<"],\"total\":"<<cases<<",\"differences\":"<<failures<<",\"gameplay_verified\":false,\"cycle_oracle\":false}\n";std::cout<<(failures?"ARITHMETIC_GENERATED_V043620_FAIL":"ARITHMETIC_GENERATED_V043620_PASS")<<" cases="<<cases<<" differences="<<failures<<" store=checked bvs=checked state=checked\n";return failures?1:0;}
