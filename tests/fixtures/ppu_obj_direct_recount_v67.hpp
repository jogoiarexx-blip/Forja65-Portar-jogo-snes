// Pinned v67 pre-incremental direct-recount oracle, not shipped v69 source.
#pragma once
struct HistoricalDirectRecount {
 std::vector<std::uint8_t> oam=std::vector<std::uint8_t>(544);
 std::array<std::uint8_t,256> regs{};
 std::uint16_t oamAddr{}; std::uint8_t obsel{};
 mutable std::uint8_t objRangeTimeFlags{};
  std::pair<unsigned,unsigned> objDims(bool large)const{unsigned mode=(obsel>>5)&7u;static const unsigned sw[8]={8,8,8,16,16,32,16,16},sh[8]={8,8,8,16,16,32,32,32},lw[8]={16,32,64,32,64,64,32,32},lh[8]={16,32,64,32,64,64,64,32};return large?std::pair<unsigned,unsigned>{lw[mode],lh[mode]}:std::pair<unsigned,unsigned>{sw[mode],sh[mode]};}
  // Hardware OBJ evaluation is a two-stage scanline process. First select
  // at most 32 in-range sprites in OAM rotation order; then fetch at most
  // 34 visible 8-pixel slivers in REVERSE sprite order. On time overflow,
  // higher-priority (earlier) OAM sprites can lose their graphics entirely.
  struct SpriteSliver {
    int x{};unsigned tile{},y{},palette{};std::uint8_t priority{},index{};bool hflip{};
  };
  struct SpriteEvaluation {
    std::array<SpriteSliver,34> slivers{};
    unsigned count{};
    bool rangeOver{},timeOver{};
  };
  SpriteEvaluation evaluateSpriteSlivers(int sy)const{
    SpriteEvaluation out{};
    std::array<unsigned,32> selected{};
    unsigned count=0;
    const unsigned first=(regs[3]&0x80u)?((oamAddr>>1)&127u):0u;
    for(unsigned si=0;si<128u;si++){
      const unsigned i=(first+si)&127u,o=i*4u;
      const unsigned pair=(oam[512u+(i>>2)]>>((i&3u)*2u))&3u;
      auto dims=objDims((pair&2u)!=0);
      const int x=((int)oam[o]|((pair&1u)?256:0));
      const int sx=x>=256?x-512:x;
      const unsigned py=((unsigned)(sy-(int)oam[o+1]+256))&255u;
      if(py>=dims.second)continue;
      // X=-256 is a SNES hardware special case: it consumes evaluation
      // slots, but must not paint pixels on the screen.
      if(!((sx>-(int)dims.first && sx<256) || sx==-256))continue;
      if(count==selected.size()){out.rangeOver=true;objRangeTimeFlags|=0x40u;break;}
      selected[count++]=i;
    }
    // Selected sprites are processed backwards to model the fetch buffer.
    // Tiles are evaluated left-to-right in SCREEN order, even on H-flip.
    for(unsigned pos=count;pos>0;--pos){
      const unsigned i=selected[pos-1],o=i*4u;
      const unsigned pair=(oam[512u+(i>>2)]>>((i&3u)*2u))&3u;
      const auto dims=objDims((pair&2u)!=0);
      const unsigned w=dims.first;
      const int rx=(int)oam[o]|((pair&1u)?256:0);
      const int sx=rx>=256?rx-512:rx;
      const unsigned py=((unsigned)(sy-(int)oam[o+1]+256))&255u;
      const unsigned at=oam[o+3],name=(unsigned)oam[o+2]|((at&1u)<<8);
      const unsigned qy=(at&0x80u)?(dims.second-1u-py):py;
      for(unsigned xoff=0;xoff<w;xoff+=8u){
        int tileX=sx+(int)xoff;
        const int checkX=sx==-256?(int)xoff:tileX;
        if(checkX<=-8||checkX>=256)continue;
        if(out.count==out.slivers.size()){out.timeOver=true;objRangeTimeFlags|=0x80u;return out;}
        const unsigned qx=(at&0x40u)?(w-1u-xoff):xoff;
        const unsigned tile=(name&0x100u)|((((name&0xF0u)+((qy>>3)<<4))&0xF0u))|((name+(qx>>3))&0x0Fu);
        out.slivers[out.count++]={tileX,tile,qy&7u,(at>>1)&7u,
          (std::uint8_t)(4u+((at>>4)&3u)*4u),(std::uint8_t)i,(at&0x40u)!=0};
      }
    }
    return out;
  }
};
