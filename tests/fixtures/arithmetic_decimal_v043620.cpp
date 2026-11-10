#include "runtime.hpp"
#include "ares_arithmetic_reference_v043620.hpp"
#include <fstream>
#include <iostream>
#include <array>
using upstream_ares_reference::AresArithmeticReference;
struct Totals {std::uint64_t cases{},differences{},result{},carry{},overflow{},negative{},zero{},validBcdDifferences{};};
static bool valid(unsigned v,unsigned width){for(unsigned s=0;s<width;s+=4)if(((v>>s)&15)>9)return false;return true;}
static std::array<Totals,8> totals;static std::uint64_t unchangedFailures;
static void test(unsigned a,unsigned b,unsigned width,bool carry,bool decimal,bool subtract){
 CpuState c;c.e=width==8;c.m8=width==8;c.x8=true;c.a=std::uint16_t(width==8?0xa500|a:a);c.c=carry;c.decimalMode=decimal;c.i=true;c.s=0x1a0;c.x=0x12;c.y=0x34;c.d=0x5678;c.db=0x7e;c.pb=0x80;
 AresArithmeticReference ref;ref.A.w=c.a;ref.DF=decimal;ref.CF=carry;
 if(subtract){c.sbc(b);if(width==8)ref.algorithmSBC8(std::uint8_t(b));else ref.algorithmSBC16(b);}else{c.adc(b);if(width==8)ref.algorithmADC8(std::uint8_t(b));else ref.algorithmADC16(b);}
 auto&t=totals[(width==16?4:0)+(decimal?2:0)+(subtract?1:0)];t.cases++;
 bool result=c.a!=ref.A.w,cf=c.c!=ref.CF,vf=c.v!=ref.VF,nf=c.n!=ref.NF,zf=c.z!=ref.ZF;
 t.result+=result;t.carry+=cf;t.overflow+=vf;t.negative+=nf;t.zero+=zf;
 if(result||cf||vf||nf||zf){t.differences++;if(valid(a,width)&&valid(b,width))t.validBcdDifferences++;if(t.differences==1)std::cerr<<"ARITH_FIRST width="<<width<<" decimal="<<decimal<<" subtract="<<subtract<<" A="<<std::hex<<a<<" B="<<b<<" C="<<carry<<" expectedA="<<ref.A.w<<" actualA="<<c.a<<" expectedV="<<ref.VF<<" actualV="<<c.v<<std::dec<<'\n';}
 if(c.e!=(width==8)||c.m8!=(width==8)||!c.x8||c.decimalMode!=decimal||!c.i||c.s!=0x1a0||c.x!=0x12||c.y!=0x34||c.d!=0x5678||c.db!=0x7e||c.pb!=0x80)unchangedFailures++;
}
int main(){
 // Exhaustive 8-bit input space, including invalid BCD, both carry values and modes.
 for(unsigned a=0;a<256;a++)for(unsigned b=0;b<256;b++)for(bool carry:{false,true})for(bool decimal:{false,true})for(bool sub:{false,true})test(a,b,8,carry,decimal,sub);
 // Full accumulator space in 16-bit mode against carry/borrow and sign boundaries.
 for(unsigned a=0;a<65536;a++)for(unsigned b:{0u,1u,9u,0x10u,0x79u,0x99u,0x999u,0x7999u,0x8000u,0x9999u,0xffffu})for(bool carry:{false,true})for(bool decimal:{false,true})for(bool sub:{false,true})test(a,b,16,carry,decimal,sub);
 // Additional reproducible operand distribution, not a claim of exhaustive 16-bit pairs.
 unsigned random=0x65c816u;for(unsigned k=0;k<65536;k++){random=random*1664525u+1013904223u;unsigned a=random&65535;random=random*1664525u+1013904223u;unsigned b=random>>16;for(bool carry:{false,true})for(bool decimal:{false,true})for(bool sub:{false,true})test(a,b,16,carry,decimal,sub);}
 std::uint64_t count=0,failures=unchangedFailures;std::ofstream report("arithmetic-results.json");report<<"{\"schema\":\"forja65.arithmetic-diff.v1\",\"groups\":[";
 for(unsigned j=0;j<totals.size();j++){const auto&t=totals[j];count+=t.cases;failures+=t.differences;if(j)report<<',';report<<"{\"width\":"<<(j<4?8:16)<<",\"decimal\":"<<((j&2)?"true":"false")<<",\"subtract\":"<<((j&1)?"true":"false")<<",\"cases\":"<<t.cases<<",\"differences\":"<<t.differences<<",\"result\":"<<t.result<<",\"carry\":"<<t.carry<<",\"overflow\":"<<t.overflow<<",\"negative\":"<<t.negative<<",\"zero\":"<<t.zero<<",\"valid_bcd_differences\":"<<t.validBcdDifferences<<"}";}
 report<<"],\"cases\":"<<count<<",\"differences\":"<<failures<<",\"unchanged_register_failures\":"<<unchangedFailures<<",\"exhaustive_8bit\":true,\"exhaustive_16bit\":false,\"cycle_oracle\":false,\"gameplay_verified\":false}\n";
 std::cout<<(failures?"ARITHMETIC_DECIMAL_V043620_FAIL":"ARITHMETIC_DECIMAL_V043620_PASS")<<" cases="<<count<<" differences="<<failures<<" preserved_registers="<<(unchangedFailures==0)<<" reference=ares-micro\n";return failures?1:0;
}
