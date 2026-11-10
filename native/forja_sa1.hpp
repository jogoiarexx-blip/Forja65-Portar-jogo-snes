#ifndef FORJA65_SA1_HPP
#define FORJA65_SA1_HPP
#pragma once
#include <array>
#include <cstdint>
#include <vector>
#include <stdexcept>
#include <algorithm>
// SA-1 board model, independently expressed from documented register behavior.
// Aggregate instruction timing/CPU scheduling is a separate experimental layer.
struct ForjaSa1 {
 std::array<std::uint8_t,256> reg{};
 std::array<std::uint8_t,2048> iram{};
 std::vector<std::uint8_t>*rom{},*bw{};
 std::uint8_t sf{},cf{};bool resetPending{},bwDirty{},overflow{},conversion{};
 std::uint64_t result{},dmaBytes{},registerReads{},registerWrites{},resetReleases{};
 unsigned bitOffset{},bitLength{16},conversionLine{};std::uint32_t bitAddress{};
 std::uint32_t timerH{},timerV{};std::uint16_t latchH{},latchV{};
 ForjaSa1(){reg[0]=0x20;reg[0x21]=1;reg[0x22]=2;reg[0x23]=3;reg[0x28]=15;}
 void bind(std::vector<std::uint8_t>&r,std::vector<std::uint8_t>&b){rom=&r;bw=&b;}
 static bool io(std::uint32_t a){return (a&0x400000u)==0;}
 static std::size_t mirror(std::size_t at,std::size_t n){
  if(!n)return std::size_t(-1);
  std::size_t base=0,mask=1u<<23;
  while(at>=n){while(!(at&mask))mask>>=1;at-=mask;if(n>mask){n-=mask;base+=mask;}mask>>=1;}
  return base+at;
 }
 std::uint16_t vector(unsigned low)const{return reg[low]|(unsigned(reg[low+1])<<8);}
 std::uint32_t triple(unsigned low)const{return vector(low)|(unsigned(reg[low+2])<<16);}
 void tripleSet(unsigned low,std::uint32_t value){for(unsigned i=0;i<3;i++)reg[low+i]=(value>>(i*8))&255;}
 bool held()const{return (reg[0]&0x60)!=0;}
 bool scpuIrq()const{return (sf&reg[1]&0xa0)!=0;}
 bool sa1Irq()const{return (cf&reg[0x0a]&0xe0)!=0;}
 bool sa1Nmi()const{return (cf&reg[0x0a]&0x10)!=0;}
 std::size_t romOffset(std::uint32_t a)const{
  const auto bank=(a>>16)&255u,lo=a&65535u;unsigned slot,within;
  if(io(a)&&lo>=0x8000){slot=((bank&0x80)?2:0)+((bank&0x20)?1:0);within=((bank&31)<<15)|(lo&32767);}
  else if(bank>=0xc0){slot=(bank>>4)-12;within=((bank&15)<<16)|lo;}
  else return std::size_t(-1);
  unsigned page=reg[0x20+slot]&7;
  if(io(a)&&!(reg[0x20+slot]&128))page=slot;
  return rom&& !rom->empty()?mirror((page<<20)|within,rom->size()):std::size_t(-1);
 }
 bool primaryCodeStable(std::uint32_t a)const{
  const unsigned bank=(a>>16)&255,lo=a&65535u;std::size_t initial;
  if(io(a)&&lo>=0x8000)initial=((bank&63)<<15)|(lo&32767u),initial+=(bank&128)?0x200000u:0;
  else if(bank>=0xc0)initial=((bank&63)<<16)|lo;
  else return true;
  return rom&&!rom->empty()&&romOffset(a)==mirror(initial,rom->size());
 }
 std::uint8_t bwRead(std::uint32_t a,std::uint8_t open=0xff)const{return bw&&!bw->empty()?(*bw)[mirror(a,bw->size())]:open;}
 void bwWrite(std::uint32_t a,std::uint8_t v,bool protect=true){
  if(!bw||bw->empty())return;
  if(protect&&!(reg[0x26]&128)&&!(reg[0x27]&128)&&(a&0x3ffffu)<(0x100u<<(reg[0x28]&15)))return;
  (*bw)[mirror(a,bw->size())]=v;bwDirty=true;
 }
 std::uint8_t bitmapRead(std::uint32_t pixel)const{
  const unsigned bits=(reg[0x3f]&128)?2:4,shift=(pixel%(8/bits))*bits;
  return (bwRead((pixel&0xfffffu)/(8/bits))>>shift)&((1u<<bits)-1);
 }
 void bitmapWrite(std::uint32_t pixel,std::uint8_t v){
  const unsigned bits=(reg[0x3f]&128)?2:4,shift=(pixel%(8/bits))*bits,mask=((1u<<bits)-1)<<shift;
  const auto at=(pixel&0xfffffu)/(8/bits);bwWrite(at,(bwRead(at)&~mask)|((v<<shift)&mask),false);
 }
 bool handlesScpu(std::uint32_t a)const{
  auto b=a>>16,lo=a&65535u;
  return (io(a)&&((lo>=0x2200&&lo<=0x23ff)||(lo>=0x3000&&lo<=0x37ff)||(lo>=0x6000&&lo<=0x7fff)))||(b>=0x40&&b<=0x4f);
 }
 std::uint8_t vbr(std::uint32_t a)const{
  if(auto off=romOffset(a);off!=std::size_t(-1))return (*rom)[off];
  auto b=a>>16,lo=a&65535u;
  if(io(a)&&(lo<0x800||(lo>=0x3000&&lo<0x3800)))return iram[lo&2047];
  if(io(a)&&lo>=0x6000&&lo<0x8000)return bwRead(lo);
  if(b>=0x40&&b<=0x4f)return bwRead(a);
  return 0xff;
 }
 void advanceBits(){bitOffset+=bitLength;bitAddress=(bitAddress+(bitOffset/8))&0xffffffu;bitOffset%=8;}
 std::uint8_t read(bool side,std::uint32_t a,std::uint8_t open){
  a&=0xffffffu;auto b=a>>16,lo=a&65535u;
  if(io(a)&&lo>=0x2200&&lo<=0x23ff){
   ++registerReads;
   if(!side)return lo==0x2300?std::uint8_t(sf|(reg[9]&0x5f)):open;
   if(lo==0x2301)return cf|(reg[0]&15);
   if(lo==0x2302){latchH=timerH/4;latchV=timerV;return latchH;}
   if(lo==0x2303)return latchH>>8;
   if(lo==0x2304)return latchV;
   if(lo==0x2305)return latchV>>8;
   if(lo>=0x2306&&lo<=0x230a)return result>>((lo-0x2306)*8);
   if(lo==0x230b)return overflow?128:0;
   if(lo==0x230c||lo==0x230d){
    std::uint32_t bits=0;for(unsigned i=0;i<3;i++)bits|=std::uint32_t(vbr((bitAddress+i)&0xffffffu))<<(i*8);
    bits>>=bitOffset;auto v=std::uint8_t(bits>>(lo==0x230d?8:0));
    if(lo==0x230d&&(reg[0x58]&128)){advanceBits();}return v;
   }
   return 0xff;
  }
  if(io(a)&&((lo>=0x3000&&lo<0x3800)||(side&&lo<0x800)))return iram[lo&2047];
  if(io(a)&&lo>=0x6000&&lo<0x8000){
   if(side&&(reg[0x25]&128))return bitmapRead((unsigned(reg[0x25]&127)<<13)|(lo&8191));
   auto at=(unsigned(reg[side?0x25:0x24]&31)<<13)|(lo&8191);
   return !side&&conversion?convertedRead(at):bwRead(at,open);
  }
  if(b>=0x40&&b<=(side?0x5f:0x4f))return !side&&conversion?convertedRead(a&0xfffff):bwRead(a,open);
  if(side&&b>=0x60&&b<=0x6f)return bitmapRead(a);
  if(io(a)&&b==0){
   if(side&&lo>=0xffe0){
    unsigned vec=0;if(lo==0xfffc||lo==0xfffd)vec=3;
    if(lo==0xffea||lo==0xffeb||lo==0xfffa||lo==0xfffb)vec=5;
    if(lo==0xffee||lo==0xffef||lo==0xfffe||lo==0xffff)vec=7;
    if(vec)return vector(vec)>>((lo&1)*8);
   }
   if(!side&&(lo==0xffea||lo==0xffeb)&&(reg[9]&0x10))return vector(0xc)>>((lo&1)*8);
   if(!side&&(lo==0xffee||lo==0xffef)&&(reg[9]&0x40))return vector(0xe)>>((lo&1)*8);
  }
  if(auto off=romOffset(a);off!=std::size_t(-1))return (*rom)[off];
  return open;
 }
 void math(){
  const auto a=vector(0x51),b=vector(0x53);const auto signedA=std::int32_t(std::int16_t(a));
  if(reg[0x50]&2){
   const auto sum=std::int64_t(result)+std::int64_t(signedA)*std::int16_t(b);
   overflow=(std::uint64_t(sum)>>40)!=0;result=std::uint64_t(sum)&0xffffffffffULL;
  }else if(reg[0x50]&1){
   if(!b)result=0;else{const auto extended=std::int64_t(signedA)+std::int64_t(b)*65536;
    result=(std::uint32_t(extended%b)<<16)|std::uint16_t(extended/b-65536);}
   reg[0x51]=reg[0x52]=0;
  }else result=std::uint32_t(signedA*std::int16_t(b));
  reg[0x53]=reg[0x54]=0;
 }
 void dma(){
  const auto control=reg[0x30];const unsigned source=control&3;const bool destBw=(control&4)!=0;
  if(source==3||(source==1&&destBw)||(source==2&&!destBw))throw std::runtime_error("SA1 unsupported DMA device pair");
  auto src=triple(0x32),dst=triple(0x35);const unsigned n=vector(0x38);
  for(unsigned i=0;i<n;i++){
   std::uint8_t value=0xff;
   if(source==0){auto off=romOffset(src);if(off!=std::size_t(-1))value=(*rom)[off];}
   else if(source==1)value=bwRead(src);else value=iram[src&2047];
   if(destBw)bwWrite(dst,value,false);else iram[dst&2047]=value;
   src=(src+1)&0xffffff;dst=(dst+1)&0xffffff;
  }
  tripleSet(0x32,src);tripleSet(0x35,dst);reg[0x38]=reg[0x39]=0xff;cf|=0x20;dmaBytes+=n;
 }
 unsigned depth()const{return 8u>>std::min(2u,unsigned(reg[0x31]&3));}
 void convertRow(const std::uint8_t*p,unsigned at){
  const unsigned bpp=depth();
  for(unsigned plane=0;plane<bpp;plane++){
   unsigned packed=0;for(unsigned x=0;x<8;x++)packed|=((p[x]>>plane)&1)<<(7-x);
   iram[(at+(plane/2)*16+(plane%2))&2047]=packed;
  }
 }
 std::uint8_t convertedRead(std::uint32_t at){
  const unsigned bpp=depth(),tileBytes=8*bpp,mask=tileBytes-1,columns=1u<<std::min(5u,unsigned((reg[0x31]>>2)&7));
  if(!(at&mask)){
   const unsigned src=triple(0x32),dst=triple(0x35);const unsigned tile=((at-src)&(bw->size()-1))/(tileBytes);
   const unsigned stride=columns*bpp,origin=src+(tile/columns)*8*stride+(tile%columns)*bpp;
   for(unsigned y=0;y<8;y++){
    std::array<std::uint8_t,8> pixels{};
    for(unsigned x=0;x<8;x++){unsigned bit=x*bpp;pixels[x]=(bwRead(origin+y*stride+bit/8)>>(bit%8))&((1u<<bpp)-1);}
    convertRow(pixels.data(),dst+y*2);
   }
  }
  return iram[(triple(0x35)+(at&mask))&2047];
 }
 void write(bool side,std::uint32_t a,std::uint8_t v){
  a&=0xffffffu;auto b=a>>16,lo=a&65535u;
  if(io(a)&&lo>=0x2200&&lo<=0x23ff){
   ++registerWrites;const unsigned r=lo-0x2200;
   const bool shared=r>=0x31&&r<=0x37;
   const bool scpu=r<=8||(r>=0x20&&r<=0x24)||r==0x26||r==0x28||r==0x29;
   const bool ccpu=(r>=9&&r<=0x15)||r==0x25||r==0x27||r==0x2a||(r>=0x30&&r<=0x39)||(r>=0x3f&&r<=0x54)||(r>=0x58&&r<=0x5b);
   if(!(shared||(side?ccpu:scpu)))return;
   const auto prev=reg[r];reg[r]=v;
   if(r==0){if((prev&0x20)&&!(v&0x20)){resetPending=true;resetReleases++;reg[0x2a]=0;}cf|=v&0x90;}
   if(r==2)sf&=~(v&0xa0);
   if(r==9)sf|=v&0x80;
   if(r==0xb)cf&=~(v&0xf0);
   if(r==0x11)timerH=timerV=0;
   if(r==0x31&&(v&128))conversion=false;
   if((r==0x36||r==0x37)&&(reg[0x30]&128)){
    if(reg[0x30]&0x20){if(r==0x36&&(reg[0x30]&0x10)){conversion=true;sf|=0x20;}}
    else if((r==0x36&&!(reg[0x30]&4))||(r==0x37&&(reg[0x30]&4)))dma();
   }
   if(r==0x30&&!(v&128))conversionLine=0;
   if((r==0x47||r==0x4f)&&(reg[0x30]&0xb0)==0xa0){
    unsigned bpp=depth(),line=conversionLine;
    unsigned at=(triple(0x35)&2047)&~((16*bpp)-1u);at+=(line&8)*bpp+(line&7)*2;
    convertRow(&reg[0x40+((line&1)*8)],at);conversionLine=(line+1)&15;
   }
   if(r==0x50&&(v&2))result=0;
   if(r==0x54)math();
   if(r>=0x59&&r<=0x5b){bitAddress=triple(0x59);if(r==0x5b)bitOffset=0;}
   if(r==0x58){bitLength=(v&15)?(v&15):16;if(!(v&128))advanceBits();}
   return;
  }
  if(io(a)&&((lo>=0x3000&&lo<0x3800)||(side&&lo<0x800))){
   if(reg[side?0x2a:0x29]&(1u<<((lo&2047)/256))){iram[lo&2047]=v;}return;
  }
  if(io(a)&&lo>=0x6000&&lo<0x8000){
   if(side&&(reg[0x25]&128))bitmapWrite((unsigned(reg[0x25]&127)<<13)|(lo&8191),v);
   else {bwWrite((unsigned(reg[side?0x25:0x24]&31)<<13)|(lo&8191),v);}return;
  }
  if(b>=0x40&&b<=(side?0x5f:0x4f)){bwWrite(a,v);return;}
  if(side&&b>=0x60&&b<=0x6f)bitmapWrite(a,v);
 }
 void tick(unsigned clocks){
  // Provisional aggregate counter; contention and per-bus timing are not modeled.
  while(clocks--){if(++timerH>=((reg[0x10]&128)?2048u:1364u)){timerH=0;timerV=(timerV+1)%((reg[0x10]&128)?512u:262u);}
   const auto mode=reg[0x10]&3;if(!mode)continue;
   if((!(mode&1)||timerH==unsigned(vector(0x12))*4)&&(!(mode&2)||timerV==vector(0x14)))cf|=0x40;
  }
 }
};

#endif
