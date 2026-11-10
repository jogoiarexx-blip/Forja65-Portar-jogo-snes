'use strict';
require('./fixtures/run_spc_probe_v0431')('spc-arithmetic-v0431',String.raw`
int main(){
 ApuBridge s;s.spc.control=0;s.correctedSpcSemantics=true;s.accurateSpcTiming=true;unsigned cases=0;
 for(bool subtract:{false,true})for(unsigned carry=0;carry<2;++carry)for(unsigned lhs=0;lhs<256;++lhs)for(unsigned rhs=0;rhs<256;++rhs){
  s.spc.pc=0x200;s.spc.ram[0x200]=subtract?0xA8:0x88;s.spc.ram[0x201]=(std::uint8_t)rhs;s.spc.ya=0x5A00u|lhs;s.spc.psw=(std::uint8_t)(0x34u|carry);
  const int value=subtract?int(lhs)-int(rhs)-int(1-carry):int(lhs)+int(rhs)+int(carry);
  const auto result=(std::uint8_t)value;
  const bool half=subtract?((lhs&15u)>=(rhs&15u)+(1-carry)):((lhs&15u)+(rhs&15u)+carry>15u);
  const bool overflow=subtract?((lhs^rhs)&(lhs^result)&128u)!=0:((~(lhs^rhs))&(lhs^result)&128u)!=0;
  const bool outCarry=subtract?value>=0:value>255;
  const auto flags=(std::uint8_t)(0x34u|(result&128u)|(overflow?64u:0u)|(half?8u:0u)|(result==0?2u:0u)|(outCarry?1u:0u));
  assert(forja65SpcStep(s)==2);assert(s.spc.a()==result&&s.spc.y()==0x5A&&s.spc.psw==flags&&s.spc.pc==0x202);++cases;
 }
 std::cout<<"SPC_ARITHMETIC_V0431_PASS vectors="<<cases<<" ADC/SBC NZVHC=independent_formula unaffected=PBI\n";
}
`);
