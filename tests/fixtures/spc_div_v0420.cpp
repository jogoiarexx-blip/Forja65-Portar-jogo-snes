#include "runtime.hpp"
#include <iostream>
#include <cstdlib>
static unsigned serialDivide(unsigned ya, unsigned x){
  // Independent nine-round 17-bit subtract/rotate model.
  for(int i=0;i<9;++i){
    ya=((ya<<1)|(ya>>16))&0x1ffff;
    if(ya>=(x<<9))ya^=1;
    if(ya&1)ya=(ya-(x<<9))&0x1ffff;
  }
  return (ya&255)|(((ya>>9)&255)<<8);
}
int main(){
 ApuBridge s; s.spc.control=0; s.spc.ram[0x200]=0x9e;
 const unsigned vectors[][4]={{0x0000,0,0x00ff,CH|CV|CN},{0x0100,1,0x0000,CH|CV|CZ},{0x1400,10,0x0aff,CV|CN},{0x05ff,10,0x0599,CN},{0xffff,255,0x0001,CH|CV}};
 for(const auto& v:vectors){
  s.correctedSpcSemantics=true;s.accurateSpcTiming=true;
  s.spc.pc=0x200;s.spc.ya=v[0];s.spc.x=v[1];s.spc.psw=0;
  if(forja65SpcStep(s)!=12 || s.spc.ya!=v[2] || s.spc.psw!=v[3]){
   std::cerr<<"DIV_FIXED_VECTOR_FAIL YA="<<v[0]<<" X="<<v[1]<<"\n";return 1;
  }
 }
 unsigned long long count=0;
 for(bool timing:{false,true})for(bool corrected:{false,true}){
  s.accurateSpcTiming=timing;s.correctedSpcSemantics=corrected;
  for(unsigned x=0;x<256;++x)for(unsigned ya=0;ya<65536;++ya){
   unsigned y=ya>>8, initial=(ya+x)&255;
   s.spc.pc=0x200;s.spc.ya=ya;s.spc.x=x;s.spc.psw=initial;
   unsigned expected,flags;
   if(corrected){
    expected=serialDivide(ya,x);
    flags=(initial&~(CN|CZ|CH|CV))|((y>=x)?CV:0)|(((y&15)>=(x&15))?CH:0);
   }else{
    unsigned d=x?x:1; expected=((ya/d)&255)|((ya%d)<<8);
    flags=(initial&~(CN|CZ|CV))|(!x?CV:0);
   }
   flags|=(expected&CN)|((expected&255)?0:CZ);
   int cycles=forja65SpcStep(s);
   if(s.spc.ya!=expected || s.spc.psw!=flags || s.spc.x!=x || s.spc.pc!=0x201 || cycles!=(timing?12:2)){
    std::cerr<<"DIV_FAIL corrected="<<corrected<<" timing="<<timing<<" YA="<<ya<<" X="<<x
     <<" actual="<<s.spc.ya<<" expected="<<expected<<" flags="<<unsigned(s.spc.psw)<<" expectedFlags="<<flags<<" cycles="<<cycles<<"\n";
    return 1;
   }
   ++count;
  }
 }
 std::cout<<"SPC_DIV_PASS cases="<<count<<" modes=4 accurate_cycles=12 legacy_cycles=2 legacy=preserved\n";
}
