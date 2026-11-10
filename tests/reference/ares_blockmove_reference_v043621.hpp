/*
ares

Copyright (c) 2004-2025 ares team, Near et al

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

*/
#pragma once
// Selected ares WDC65816 block-move bodies and SFC CPU wait, revision
// 9408cb43d4948fc3ea6e152a307a34348df3fe04. Test-only isolated nominal costs:
// refresh, DMA, IRQ/NMI, peripherals and scheduler edges are not modeled.
#include "ares_micro_reference_v043618.hpp"
#include <vector>
namespace upstream_ares_reference {
using s32=std::int32_t;using n24=std::uint32_t;
struct BlockBusEvent {char kind;unsigned address,value;bool operator==(const BlockBusEvent&)const=default;};
struct BlockWord {std::uint16_t w{};struct Byte {std::uint16_t&v;unsigned shift;operator n8()const{return n8(v>>shift);}Byte&operator+=(int q){unsigned value=unsigned(n8(*this))+unsigned(q);v=std::uint16_t((v&~(255u<<shift))|((value&255)<<shift));return *this;}}l{w,0};};
class AresBlockMoveReference {public:
 BlockWord A{},X{},Y{};struct {std::uint16_t w{};n8 b{};}PC;struct {n8 l{},b{};}U,V,W;n8 B{};
 struct {unsigned romSpeed{8};}io;std::uint64_t clocks{};bool fetching{},observe{true};
 std::vector<n8> memory=std::vector<n8>(0x20000);std::array<n8,65536> code{};std::vector<BlockBusEvent> events;
 auto wait(n24 address)const->u32;
 n8 read(u32 address){clocks+=wait(address);n8 value;if(fetching)value=code[address&65535];else{if((address&0xfe0000)!=0x7e0000)throw std::logic_error("oracle data outside WRAM");value=memory[address&0x1ffff];if(observe)events.push_back({'r',address,value});}return value;}
 void write(u32 address,n8 value){clocks+=wait(address);if((address&0xfe0000)!=0x7e0000)throw std::logic_error("oracle write outside WRAM");memory[address&0x1ffff]=value;if(observe)events.push_back({'w',address,value});}
 n8 fetch(){fetching=true;auto value=read((unsigned(PC.b)<<16)|PC.w++);fetching=false;return value;}
 void idle(){clocks+=6;}
 auto instructionBlockMove8(s32 adjust)->void;auto instructionBlockMove16(s32 adjust)->void;
 void run(unsigned pc,unsigned opcode,bool x8){PC.b=n8(pc>>16);PC.w=std::uint16_t(pc);for(;;){if(fetch()!=opcode)throw std::logic_error("changed reference opcode");if(x8)instructionBlockMove8(opcode==0x44?-1:1);else instructionBlockMove16(opcode==0x44?-1:1);if(A.w==0xffff)break;}}
};
#define L
auto AresBlockMoveReference::wait(n24 address) const -> u32 {
  //00-3f,80-bf:8000-ffff; 40-7f,c0-ff:0000-ffff
  if(address & 0x408000) return address & 0x800000 ? io.romSpeed : 8;

  //00-3f,80-bf:0000-1fff,6000-7fff
  if(address + 0x6000 & 0x4000) return 8;

  //00-3f,80-bf:2000-3fff,4200-5fff
  if(address - 0x4000 & 0x7e00) return 6;

  //00-3f,80-bf:4000-41ff
  return 12;
}
auto AresBlockMoveReference::instructionBlockMove8(s32 adjust) -> void {
  U.b = fetch();
  V.b = fetch();
  B = U.b;
  W.l = read(V.b << 16 | X.w);
  write(U.b << 16 | Y.w, W.l);
  idle();
  X.l += adjust;
  Y.l += adjust;
L idle();
  if(A.w--) PC.w -= 3;
}
auto AresBlockMoveReference::instructionBlockMove16(s32 adjust) -> void {
  U.b = fetch();
  V.b = fetch();
  B = U.b;
  W.l = read(V.b << 16 | X.w);
  write(U.b << 16 | Y.w, W.l);
  idle();
  X.w += adjust;
  Y.w += adjust;
L idle();
  if(A.w--) PC.w -= 3;
}
#undef L
}
