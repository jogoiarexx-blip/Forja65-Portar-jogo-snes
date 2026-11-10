'use strict';
require('./fixtures/run_spc_probe_v0431')('spc-postincrement-v0431',String.raw`
int main(){
 unsigned cases=0;
 for(bool corrected:{false,true})for(unsigned page:{0u,0x20u})for(unsigned op:{0xAFu,0xBFu}){
  ApuBridge s;s.spc.control=0;s.accurateSpcTiming=true;s.correctedSpcSemantics=corrected;
  for(unsigned x=0;x<256;++x){
   const unsigned address=(corrected&&page?0x100u:0u)+x;
   if(address>=0xF0u&&address<=0xFFu)continue; // tested separately as real I/O
   for(unsigned value=0;value<256;++value){
    s.spc.pc=0x200;s.spc.ram[0x200]=(std::uint8_t)op;s.spc.x=(std::uint8_t)x;s.spc.ya=0x5A00u|value;s.spc.psw=(std::uint8_t)(page|0x4Bu);
    s.spc.ram[x]=0x33;s.spc.ram[0x100u+x]=0x66;
    if(op==0xBFu)s.spc.ram[address]=(std::uint8_t)value;
    const auto flags=s.spc.psw;const auto cycles=forja65SpcStep(s);
    assert(cycles==4&&s.spc.pc==0x201&&s.spc.x==(std::uint8_t)(x+1u)&&s.spc.y()==0x5A);
    if(op==0xAFu){assert(s.spc.ram[address]==value&&s.spc.a()==value&&s.spc.psw==flags);}
    else{const auto expected=(std::uint8_t)((flags&~0x82u)|(value&0x80u)|(value==0?2u:0u));assert(s.spc.a()==value&&s.spc.psw==expected);}
    if(corrected&&page)assert(s.spc.ram[x]==0x33);
    ++cases;
   }
  }
 }
 // Page selection changes whether X=$F4 touches a CPU port or ordinary RAM.
 for(unsigned op:{0xAFu,0xBFu}){ApuBridge s;s.spc.control=0;s.correctedSpcSemantics=true;s.accurateSpcTiming=true;s.spc.pc=0x200;s.spc.ram[0x200]=(std::uint8_t)op;s.spc.x=0xF4;s.spc.psw=0x20;s.spc.setA(0x77);s.spc.ram[0x1F4]=0x88;s.spc.portIn[0]=0x11;s.spc.portOut[0]=0x22;forja65SpcStep(s);assert(s.spc.portOut[0]==0x22&&s.spc.portIn[0]==0x11);assert(op==0xAFu?s.spc.ram[0x1F4]==0x77:s.spc.a()==0x88);}
 std::cout<<"SPC_POSTINCREMENT_V0431_PASS vectors="<<cases<<" operations=AF/BF pages=0/1 legacy=preserved flags=verified IO_page=isolated\n";
}
`);
