// v0.3.80 raster reference: OBJ bank/address and 8-bit Y wrapping updated.
// Original v0.3.4 frozen reference retained as ppu-v034-reference-historical.hpp.
// Frozen v0.3.34 scanout oracle. Kept separate from optimized production code.
struct ReferencePpuState {
  std::uint8_t regs[0x40]{}; std::vector<std::uint8_t> vram=std::vector<std::uint8_t>(0x10000); std::vector<std::uint8_t> cgram=std::vector<std::uint8_t>(512); std::vector<std::uint8_t> oam=std::vector<std::uint8_t>(544);
  std::uint8_t inidisp{},obsel{},bgmode{},mosaic{},vmain{},tm{},ts{},tmw{},tsw{},setini{},bgsc[4]{},bgnba[4]{};
  std::uint8_t m7sel{},w12sel{},w34sel{},wobjsel{},wh[4]{},wbglog{},wobjlog{},cgwsel{},cgadsub{},coldata{};
  std::uint8_t fixedR{},fixedG{},fixedB{}; std::uint16_t m7[6]{}; std::uint8_t m7Latch[6]{}; bool m7High[6]{};
  bool forceBlank{}; std::uint8_t brightness{}; std::uint16_t vmadd{},oamAddr{},vramReadBuffer{},oamWriteRegister{};
  std::uint8_t bgOfsByte{},m7Byte{},cgAddr{},cgSavedByte{}; bool oamFlip{},oamReadFlip{},cgHigh{},cgReadHigh{};
  std::uint16_t scrollX[4]{},scrollY[4]{},hCounter{},vCounter{}; bool hCounterHigh{},vCounterHigh{};
  std::uint16_t vramStep()const{switch(vmain&3){case 0:return 1;case 1:return 32;default:return 128;}}
  std::uint16_t vramMappedWord()const{unsigned mode=(vmain>>2)&3u;if(!mode)return vmadd;static const unsigned count[4]={0,32,64,128},shift[4]={0,5,6,7};unsigned c=count[mode],mask=c*8u-1u,rem=vmadd&mask;return(std::uint16_t)((vmadd&~mask)+(rem>>shift[mode])+((rem&(c-1u))<<3));}
  std::uint16_t vramByteAddress(bool high)const{return(std::uint16_t)(((std::uint32_t)vramMappedWord()*2u+(high?1u:0u))&0xFFFFu);}
  void updateVramReadBuffer(){auto p=vramByteAddress(false);vramReadBuffer=(std::uint16_t)(vram[p]|(vram[(p+1)&0xFFFFu]<<8));}
  void incVram(bool highPort){bool afterHigh=(vmain&0x80)!=0;if(afterHigh==highPort)vmadd=(std::uint16_t)(vmadd+vramStep());}
  void writeScroll(unsigned i,std::uint8_t v){if(i>=8)return;unsigned bg=i>>1;if((i&1u)==0)scrollX[bg]=(std::uint16_t)(((std::uint16_t)v<<8)|(bgOfsByte&~7u)|((scrollX[bg]>>8)&7u));else scrollY[bg]=(std::uint16_t)(((std::uint16_t)v<<8)|bgOfsByte);bgOfsByte=v;if(i<2)m7Byte=v;}
  void writeM7(unsigned i,std::uint8_t v){if(i>=6)return;m7[i]=(std::uint16_t)(m7Byte|((std::uint16_t)v<<8));m7Byte=v;}
  void writeOam(std::uint8_t v){if(!oamFlip)oamWriteRegister=(std::uint16_t)((oamWriteRegister&0xFF00u)|v);if(oamAddr&0x100u){unsigned a=((oamAddr&0x10Fu)<<1)+(oamFlip?1u:0u);if(a<oam.size())oam[a]=v;}else if(oamFlip){oamWriteRegister=(std::uint16_t)((oamWriteRegister&0x00FFu)|((std::uint16_t)v<<8));unsigned a=(oamAddr&0xFFu)<<1;if(a+1<oam.size()){oam[a]=(std::uint8_t)oamWriteRegister;oam[a+1]=(std::uint8_t)(oamWriteRegister>>8);}}oamFlip=!oamFlip;if(!oamFlip)oamAddr=(std::uint16_t)((oamAddr+1)&0x1FFu);}
  std::uint8_t readOam(){unsigned a=(oamAddr&0x100u)?(((oamAddr&0x10Fu)<<1)+(oamReadFlip?1u:0u)):(((oamAddr&0xFFu)<<1)+(oamReadFlip?1u:0u));std::uint8_t v=a<oam.size()?oam[a]:0;oamReadFlip=!oamReadFlip;if(!oamReadFlip)oamAddr=(std::uint16_t)((oamAddr+1)&0x1FFu);return v;}
  void writeCgram(std::uint8_t v){if(!cgHigh)cgSavedByte=v;else{unsigned a=(unsigned)cgAddr*2u;cgram[a&0x1FFu]=cgSavedByte;cgram[(a+1u)&0x1FFu]=v&0x7Fu;cgAddr++;}cgHigh=!cgHigh;}
  std::uint8_t readCgram(){unsigned a=(unsigned)cgAddr*2u;std::uint8_t v=!cgReadHigh?cgram[a&0x1FFu]:(cgram[(a+1u)&0x1FFu]&0x7Fu);if(cgReadHigh)cgAddr++;cgReadHigh=!cgReadHigh;return v;}
  void writeFixedColor(std::uint8_t v){coldata=v;std::uint8_t q=v&31u;if(v&0x20)fixedR=q;if(v&0x40)fixedG=q;if(v&0x80)fixedB=q;}
  void write(std::uint16_t a,std::uint8_t v){if(a>=0x2100&&a<=0x213F)regs[a-0x2100]=v;switch(a){
    case 0x2100:inidisp=v;forceBlank=(v&0x80)!=0;brightness=v&0x0F;break;case 0x2101:obsel=v;break;
    case 0x2102:oamAddr=(std::uint16_t)(((regs[3]&1u)<<8)|v);oamFlip=oamReadFlip=false;break;case 0x2103:oamAddr=(std::uint16_t)(((v&1u)<<8)|regs[2]);oamFlip=oamReadFlip=false;break;case 0x2104:writeOam(v);break;case 0x2105:bgmode=v;break;case 0x2106:mosaic=v;break;
    case 0x2107:case 0x2108:case 0x2109:case 0x210A:bgsc[a-0x2107]=v;break;
    case 0x210B:bgnba[0]=v&0x0F;bgnba[1]=(v>>4)&0x0F;break;case 0x210C:bgnba[2]=v&0x0F;bgnba[3]=(v>>4)&0x0F;break;
    case 0x210D:case 0x210E:case 0x210F:case 0x2110:case 0x2111:case 0x2112:case 0x2113:case 0x2114:writeScroll(a-0x210D,v);break;
    case 0x2115:vmain=v;break;case 0x2116:vmadd=(vmadd&0xFF00)|v;updateVramReadBuffer();break;case 0x2117:vmadd=(vmadd&0x00FF)|((std::uint16_t)v<<8);updateVramReadBuffer();break;
    case 0x2118:vram[vramByteAddress(false)]=v;incVram(false);break;case 0x2119:vram[vramByteAddress(true)]=v;incVram(true);break;
    case 0x211A:m7sel=v;break;case 0x211B:case 0x211C:case 0x211D:case 0x211E:case 0x211F:case 0x2120:writeM7(a-0x211B,v);break;
    case 0x2121:cgAddr=v;cgHigh=cgReadHigh=false;break;case 0x2122:writeCgram(v);break;
    case 0x2123:w12sel=v;break;case 0x2124:w34sel=v;break;case 0x2125:wobjsel=v;break;case 0x2126:case 0x2127:case 0x2128:case 0x2129:wh[a-0x2126]=v;break;case 0x212A:wbglog=v;break;case 0x212B:wobjlog=v;break;
    case 0x212C:tm=v;break;case 0x212D:ts=v;break;case 0x212E:tmw=v;break;case 0x212F:tsw=v;break;case 0x2130:cgwsel=v;break;case 0x2131:cgadsub=v;break;case 0x2132:writeFixedColor(v);break;case 0x2133:setini=v;break;default:break;}}
  std::uint8_t read(std::uint16_t a){switch(a){
    case 0x2134:case 0x2135:case 0x2136:{std::int32_t r=(std::int32_t)(std::int16_t)m7[0]*(std::int32_t)(std::int8_t)(m7[1]>>8);return(std::uint8_t)((r>>((a-0x2134)*8))&0xFF);}
    case 0x2137:hCounterHigh=vCounterHigh=false;return 0;
    case 0x2138:return readOam();
    case 0x2139:{std::uint8_t v=(std::uint8_t)vramReadBuffer;if(!(vmain&0x80u)){updateVramReadBuffer();vmadd=(std::uint16_t)(vmadd+vramStep());}return v;}
    case 0x213A:{std::uint8_t v=(std::uint8_t)(vramReadBuffer>>8);if(vmain&0x80u){updateVramReadBuffer();vmadd=(std::uint16_t)(vmadd+vramStep());}return v;}
    case 0x213B:return readCgram();
    case 0x213C:{std::uint8_t v=!hCounterHigh?(std::uint8_t)hCounter:(std::uint8_t)((hCounter>>8)&1u);hCounterHigh=!hCounterHigh;return v;}
    case 0x213D:{std::uint8_t v=!vCounterHigh?(std::uint8_t)vCounter:(std::uint8_t)((vCounter>>8)&1u);vCounterHigh=!vCounterHigh;return v;}
    case 0x213E:return 0x01u;
    case 0x213F:hCounterHigh=vCounterHigh=false;return 0x03u;
    default:return(a>=0x2100&&a<=0x213F)?regs[a-0x2100]:0;}}
  std::uint32_t color(unsigned idx)const{idx&=0xFF;std::uint16_t c=(std::uint16_t)(cgram[(idx*2)&0x1FF]|((cgram[(idx*2+1)&0x1FF]&0x7F)<<8));return rgba15(c);}
  unsigned tilePixel2(std::uint32_t base,unsigned tile,unsigned x,unsigned y)const{std::uint32_t p=(base+tile*16u+(y&7u)*2u)&0xFFFFu;unsigned bit=7-(x&7u);return ((vram[p]>>bit)&1u)|(((vram[(p+1)&0xFFFFu]>>bit)&1u)<<1);}
  unsigned tilePixel4(std::uint32_t base,unsigned tile,unsigned x,unsigned y)const{std::uint32_t p=(base+tile*32u+(y&7u)*2u)&0xFFFFu;unsigned bit=7-(x&7u);return ((vram[p]>>bit)&1u)|(((vram[(p+1)&0xFFFFu]>>bit)&1u)<<1)|(((vram[(p+16)&0xFFFFu]>>bit)&1u)<<2)|(((vram[(p+17)&0xFFFFu]>>bit)&1u)<<3);}
  unsigned tilePixel8(std::uint32_t base,unsigned tile,unsigned x,unsigned y)const{std::uint32_t p=(base+tile*64u+(y&7u)*2u)&0xFFFFu;unsigned bit=7-(x&7u),q=0;for(unsigned plane=0;plane<8;plane++){unsigned a=(p+(plane>>1)*16u+(plane&1u))&0xFFFFu;q|=((vram[a]>>bit)&1u)<<plane;}return q;}
  struct LayerPixel { std::uint16_t c15{}; std::uint8_t source{5},objPal{},priority{1},oamIndex{255}; bool valid{true}; };
  static int sign13(std::uint16_t q){q&=0x1FFFu;return(q&0x1000u)?(int)q-0x2000:(int)q;}
  static int sign16(std::uint16_t q){return (int)(std::int16_t)q;}
  std::uint16_t palette15(unsigned idx)const{idx&=0xFFu;return(std::uint16_t)(cgram[(idx*2u)&0x1FFu]|((cgram[(idx*2u+1u)&0x1FFu]&0x7Fu)<<8));}
  std::uint16_t directColor15(unsigned pal,unsigned c)const{unsigned r=((c&0x07u)<<2)|((pal&0x01u)<<1),g=((c&0x38u)>>1)|(pal&0x02u),b=((c&0xC0u)>>3)|(pal&0x04u);return(std::uint16_t)((r&31u)|((g&31u)<<5)|((b&31u)<<10));}
  std::uint16_t fixed15()const{return(std::uint16_t)((fixedR&31u)|((fixedG&31u)<<5)|((fixedB&31u)<<10));}
  std::uint32_t rgba15(std::uint16_t c)const{unsigned r=(c&31u)*255u/31u,g=((c>>5)&31u)*255u/31u,b=((c>>10)&31u)*255u/31u,br=brightness;r=r*br/15u;g=g*br/15u;b=b*br/15u;return 0xFF000000u|(r<<16)|(g<<8)|b;}
  static std::uint16_t blend15(std::uint16_t a,std::uint16_t b,bool sub,bool half){int ar=a&31,ag=(a>>5)&31,ab=(a>>10)&31,br=b&31,bg=(b>>5)&31,bb=(b>>10)&31;auto f=[&](int x,int y){int q=sub?x-y:x+y;if(q<0)q=0;if(q>31)q=31;if(half)q>>=1;return q;};return(std::uint16_t)(f(ar,br)|(f(ag,bg)<<5)|(f(ab,bb)<<10));}
  bool pseudoHires()const{return(setini&0x08u)!=0;} bool interlace()const{return(setini&0x01u)!=0;} bool extbg()const{return(setini&0x40u)!=0;}
  unsigned visibleHeight()const{return(setini&0x04u)?239u:224u;} unsigned outputWidth()const{unsigned m=bgmode&7u;return(m==5||m==6||pseudoHires())?512u:256u;} unsigned outputHeight()const{return visibleHeight()*(interlace()?2u:1u);}
  bool insideWin(unsigned n,int x)const{unsigned l=wh[(n&1u)*2u],r=wh[(n&1u)*2u+1u];return l<=r&&x>=(int)l&&x<=(int)r;}
  bool combineWin(std::uint8_t sel,unsigned shift,unsigned logic,int x)const{bool e1=(sel&(1u<<(shift+1)))!=0,i1=(sel&(1u<<shift))!=0,e2=(sel&(1u<<(shift+3)))!=0,i2=(sel&(1u<<(shift+2)))!=0;if(!e1&&!e2)return false;bool w1=insideWin(0,x);if(i1)w1=!w1;bool w2=insideWin(1,x);if(i2)w2=!w2;if(!e1)return w2;if(!e2)return w1;switch(logic&3u){case 0:return w1||w2;case 1:return w1&&w2;case 2:return w1!=w2;default:return w1==w2;}}
  bool layerWindow(unsigned layer,int x)const{if(layer<2)return combineWin(w12sel,layer?4u:0u,(wbglog>>(layer*2u))&3u,x);if(layer<4)return combineWin(w34sel,(layer-2u)?4u:0u,(wbglog>>(layer*2u))&3u,x);if(layer==4)return combineWin(wobjsel,0u,wobjlog&3u,x);return combineWin(wobjsel,4u,(wobjlog>>2)&3u,x);}
  bool hiddenByWindow(unsigned layer,int x,bool sub)const{std::uint8_t mask=sub?tsw:tmw;if(layer>4||!(mask&(1u<<layer)))return false;return layerWindow(layer,x);}
  static bool regionMatch(unsigned mode,bool inside){switch(mode&3u){case 0:return false;case 1:return !inside;case 2:return inside;default:return true;}}
  std::pair<unsigned,unsigned> bgDepth(unsigned bg)const{unsigned m=bgmode&7u;if(m==0){static const unsigned lo[4]={11,10,3,2},hi[4]={15,14,7,6};return{lo[bg&3],hi[bg&3]};}if(m==1){if(bg==0)return{11,15};if(bg==1)return{10,14};if(bg==2)return{3,(bgmode&0x08u)?17u:7u};}if(m>=2&&m<=6){if(bg==0)return{7,15};if(bg==1)return{3,11};}if(m==7){if(bg==0)return{7,7};if(bg==1)return{3,11};}return{1,1};}
  LayerPixel sampleBg(unsigned bg,int sx,int sy,unsigned bpp,unsigned paletteBase=0,bool hires=false,bool allowDirect=false)const{
    LayerPixel p{};p.valid=false;p.source=(std::uint8_t)bg;if(bg>=4)return p;
    unsigned mos=((mosaic>>4)&15u)+1u;if((mosaic&(1u<<bg))&&mos>1u){sx-=sx%(int)mos;sy-=sy%(int)mos;}
    std::uint32_t mapBase=((std::uint32_t)(bgsc[bg]&0xFCu)<<9)&0xFFFFu,charBase=((std::uint32_t)(bgnba[bg]&7u)*0x2000u)&0xFFFFu;
    unsigned sc=bgsc[bg]&3u,mapWTiles=(sc&1u)?64u:32u,mapHTiles=(sc&2u)?64u:32u;bool big=((bgmode>>(4u+bg))&1u)!=0;
    unsigned tileW=(big&&!hires)?16u:8u,tileH=big?16u:8u,mapW=mapWTiles*tileW,mapH=mapHTiles*tileH,wx=(unsigned)(sx+(int)scrollX[bg])&(mapW-1u),wy=(unsigned)(sy+(int)scrollY[bg])&(mapH-1u),tx=wx/tileW,ty=wy/tileH;
    unsigned screenX=tx>>5,screenY=ty>>5,screen=screenX+screenY*((mapWTiles+31u)>>5),localX=tx&31u,localY=ty&31u;std::uint32_t ep=(mapBase+screen*0x800u+((localY*32u+localX)*2u))&0xFFFFu;
    std::uint16_t e=(std::uint16_t)(vram[ep]|(vram[(ep+1)&0xFFFFu]<<8));unsigned tile=e&0x3FFu,pal=(e>>10)&7u;bool pri=(e&0x2000u)!=0,hf=e&0x4000u,vf=e&0x8000u;
    unsigned px=wx&(tileW-1u),py=wy&(tileH-1u);if(hf)px=tileW-1u-px;if(vf)py=tileH-1u-py;if(big){if(tileW>8u)tile=(tile+(px>>3))&0x3FFu;if(tileH>8u)tile=(tile+((py>>3)<<4))&0x3FFu;}px&=7u;py&=7u;
    unsigned ci=bpp==8?tilePixel8(charBase,tile,px,py):(bpp==4?tilePixel4(charBase,tile,px,py):tilePixel2(charBase,tile,px,py));if(!ci)return p;
    if(bpp==8&&allowDirect&&(cgwsel&1u))p.c15=directColor15(pal,ci);else if(bpp==8)p.c15=palette15(ci);else if(bpp==4)p.c15=palette15(paletteBase+pal*16u+ci);else p.c15=palette15(paletteBase+pal*4u+ci);
    auto d=bgDepth(bg);p.priority=(std::uint8_t)(pri?d.second:d.first);p.valid=true;return p;
  }
  LayerPixel sampleMode7(unsigned bg,int sx,int sy)const{
    LayerPixel p{};p.valid=false;p.source=(std::uint8_t)bg;int x=(m7sel&1u)?(255-sx):sx,y=(m7sel&2u)?(255-sy):sy;int A=sign16(m7[0]),B=sign16(m7[1]),C=sign16(m7[2]),D=sign16(m7[3]),cx=sign13(m7[4]),cy=sign13(m7[5]),hofs=sign13(scrollX[0]),vofs=sign13(scrollY[0]);
    long dx=(long)x+hofs-cx,dy=(long)y+vofs-cy;long tx=((long)A*dx+(long)B*dy)/256+cx,ty=((long)C*dx+(long)D*dy)/256+cy;bool outside=tx<0||ty<0||tx>1023||ty>1023;unsigned ux,uy,tile;
    if(!(m7sel&0x80u)){ux=(unsigned)tx&1023u;uy=(unsigned)ty&1023u;std::uint32_t mp=(((uy>>3)*128u+(ux>>3))*2u)&0xFFFFu;tile=vram[mp];}else if(outside){if(!(m7sel&0x40u))return p;ux=(unsigned)tx&7u;uy=(unsigned)ty&7u;tile=0;}else{ux=(unsigned)tx;uy=(unsigned)ty;std::uint32_t mp=(((uy>>3)*128u+(ux>>3))*2u)&0xFFFFu;tile=vram[mp];}
    std::uint32_t pp=(((tile*64u)+((uy&7u)*8u)+(ux&7u))*2u+1u)&0xFFFFu;unsigned ci=vram[pp];
    if(bg==1){if(!extbg())return p;bool pri=(ci&0x80u)!=0;ci&=0x7Fu;if(!ci)return p;p.c15=palette15(ci);p.priority=(std::uint8_t)(pri?11u:3u);}
    else{if(!ci)return p;p.c15=(cgwsel&1u)?directColor15(0,ci):palette15(ci);p.priority=7;}
    p.valid=true;return p;
  }
  std::pair<unsigned,unsigned> objDims(bool large)const{unsigned mode=(obsel>>5)&7u;static const unsigned sw[8]={8,8,8,16,16,32,16,16},sh[8]={8,8,8,16,16,32,32,32},lw[8]={16,32,64,32,64,64,32,32},lh[8]={16,32,64,32,64,64,64,32};return large?std::pair<unsigned,unsigned>{lw[mode],lh[mode]}:std::pair<unsigned,unsigned>{sw[mode],sh[mode]};}
  LayerPixel sampleSprites(int sx,int sy)const{
    LayerPixel best{};best.valid=false;best.source=4;std::uint32_t nameBase=(std::uint32_t)(obsel&7u)<<14,nameSelect=(std::uint32_t)(((obsel>>3)&3u)+1u)<<13;
    for(int si=127;si>=0;--si){unsigned i=(unsigned)si,o=i*4u,hb=oam[512u+(i>>2)],pair=(hb>>((i&3u)*2u))&3u;int x=(int)oam[o]|((pair&1u)?256:0);if(x>=256)x-=512;int y=(int)oam[o+1];unsigned at=oam[o+3],pal=(at>>1)&7u,pri=(at>>4)&3u;auto dim=objDims((pair&2u)!=0);unsigned w=dim.first,h=dim.second;int px=sx-x,py=(sy-y+256)&255;if(px<0||py<0||px>=(int)w||py>=(int)h)continue;
      unsigned qx=(at&0x40u)?(w-1u-(unsigned)px):(unsigned)px,qy=(at&0x80u)?(h-1u-(unsigned)py):(unsigned)py,name=(unsigned)oam[o+2]|((at&1u)<<8),tile=(name&0x100u)|((((name&0xF0u)+((qy>>3)<<4))&0xF0u))|((name+(qx>>3))&0x0Fu),base=nameBase+((tile&0x100u)?nameSelect:0u),ci=tilePixel4(base,tile&0xFFu,qx&7u,qy&7u);std::uint8_t depth=(std::uint8_t)(4u+pri*4u);
      if(ci&&(!best.valid||depth>best.priority||(depth==best.priority&&i<best.oamIndex))){best.c15=palette15(128u+pal*16u+ci);best.objPal=(std::uint8_t)pal;best.priority=depth;best.oamIndex=(std::uint8_t)i;best.valid=true;}}
    return best;
  }
  LayerPixel compose(int x,int y,bool sub,bool hires=false)const{
    LayerPixel out{palette15(0),5,0,1,255,true};std::uint8_t en=sub?ts:tm;unsigned mode=bgmode&7u;int wx=hires?(x>>1):x;
    auto take=[&](LayerPixel q){if(q.valid&&q.priority>out.priority)out=q;};
    auto bg=[&](unsigned n,unsigned bpp,unsigned palBase=0,bool dc=false){if(!(en&(1u<<n))||hiddenByWindow(n,wx,sub))return;take(sampleBg(n,x,y,bpp,palBase,hires,dc));};
    switch(mode){
      case 0:bg(3,2,96);bg(2,2,64);bg(1,2,32);bg(0,2,0);break;
      case 1:bg(2,2);bg(1,4);bg(0,4);break;
      case 2:bg(1,4);bg(0,4);break;
      case 3:bg(1,4);bg(0,8,0,true);break;
      case 4:bg(1,2);bg(0,8,0,true);break;
      case 5:bg(1,2);bg(0,4);break;
      case 6:bg(0,4);break;
      case 7:if((en&1u)&&!hiddenByWindow(0,wx,sub))take(sampleMode7(0,x,y));if((en&2u)&&!hiddenByWindow(1,wx,sub))take(sampleMode7(1,x,y));break;
    }
    if((en&0x10u)&&!hiddenByWindow(4,wx,sub)){take(sampleSprites(hires?(x>>1):x,y));}return out;
  }
  std::uint16_t finalMain15(int x,int y,bool hires=false)const{
    int wx=hires?(x>>1):x;bool cw=layerWindow(5,wx);auto main=compose(x,y,false,hires);if(regionMatch((cgwsel>>6)&3u,cw))main.c15=0;
    bool math=false;if(main.source<=3)math=(cgadsub&(1u<<main.source))!=0;else if(main.source==4)math=(cgadsub&0x10u)&&main.objPal>=4;else math=(cgadsub&0x20u)!=0;std::uint16_t result=main.c15;
    if(math){bool masked=regionMatch((cgwsel>>4)&3u,cw);std::uint16_t add=0;if(!masked){if(cgwsel&0x02u)add=compose(x,y,true,hires).c15;else add=fixed15();}bool half=(cgadsub&0x40u)!=0;if((cgwsel&0x02u)&&compose(x,y,true,hires).source==5)half=false;result=blend15(result,add,(cgadsub&0x80u)!=0,half);}return result;
  }
  void renderScanline(std::vector<std::uint32_t>&fb,int y,int w=256)const{if(y<0)return;if(fb.size()<(std::size_t)w*(y+1))fb.resize((std::size_t)w*(y+1),0xFF000000u);for(int x=0;x<w;x++){if(forceBlank||brightness==0){fb[(std::size_t)y*w+x]=0xFF000000u;continue;}fb[(std::size_t)y*w+x]=rgba15(finalMain15(x,y,false));}}
  void renderOutputSegment(std::vector<std::uint32_t>&fb,int y,unsigned x0,unsigned x1,unsigned field=0)const{
    if(y<0||(unsigned)y>=visibleHeight()){return;}unsigned ow=outputWidth(),oh=outputHeight(),row=interlace()?((unsigned)y*2u+(field&1u)):(unsigned)y;if(fb.size()<(std::size_t)ow*oh)fb.resize((std::size_t)ow*oh,0xFF000000u);x0=std::min(x0,ow);x1=std::min(x1,ow);if(x1<=x0)return;
    if(forceBlank||brightness==0){for(unsigned x=x0;x<x1;x++)fb[(std::size_t)row*ow+x]=0xFF000000u;return;}
    unsigned mode=bgmode&7u;if(mode==5||mode==6){int sy=interlace()?((int)y*2+(int)(field&1u)):y;for(unsigned x=x0;x<x1;x++)fb[(std::size_t)row*ow+x]=rgba15(finalMain15((int)x,sy,true));return;}
    if(pseudoHires()){for(unsigned ox=x0;ox<x1;ox++){unsigned lx=ox>>1;if((ox&1u)==0){auto sub=compose((int)lx,y,true,false);fb[(std::size_t)row*ow+ox]=rgba15(sub.c15);}else fb[(std::size_t)row*ow+ox]=rgba15(finalMain15((int)lx,y,false));}return;}
    for(unsigned x=x0;x<x1;x++)fb[(std::size_t)row*ow+x]=rgba15(finalMain15((int)x,y,false));
  }
  void renderOutputScanline(std::vector<std::uint32_t>&fb,int y,unsigned field=0)const{renderOutputSegment(fb,y,0,outputWidth(),field);}
  std::vector<std::uint32_t> renderFrame(int w=256,int h=224)const{std::vector<std::uint32_t>fb((std::size_t)w*h,0xFF000000u);for(int y=0;y<h;y++)renderScanline(fb,y,w);return fb;}
  std::vector<std::uint32_t> renderNativeFrame(unsigned field=0)const{std::vector<std::uint32_t>fb((std::size_t)outputWidth()*outputHeight(),0xFF000000u);for(unsigned y=0;y<visibleHeight();y++)renderOutputScanline(fb,(int)y,field);return fb;}
  bool savePpm(const std::string&path,int w=256,int h=224)const{auto fb=renderFrame(w,h);std::ofstream f(path,std::ios::binary);if(!f)return false;f<<"P6\n"<<w<<" "<<h<<"\n255\n";for(auto p:fb){char q[3]={(char)((p>>16)&255),(char)((p>>8)&255),(char)(p&255)};f.write(q,3);}return(bool)f;}

};
