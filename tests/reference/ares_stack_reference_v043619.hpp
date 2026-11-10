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
// Test-only adapter of selected ares WDC65816 methods at revision
// 9408cb43d4948fc3ea6e152a307a34348df3fe04. No cycle equivalence is claimed.
#include "ares_micro_reference_v043618.hpp"
#include <vector>
namespace upstream_ares_reference {
struct BusEvent {char kind;unsigned address,value;bool operator==(const BusEvent&)const=default;};
struct StackWord {std::uint16_t w{};struct Byte {std::uint16_t&v;unsigned shift;operator n8()const{return n8(v>>shift);}Byte&operator=(unsigned q){v=std::uint16_t((v&~(255u<<shift))|((q&255)<<shift));return *this;}n8 operator++(int){n8 old=*this;*this=old+1;return old;}n8 operator--(int){n8 old=*this;*this=old-1;return old;}}l{w,0},h{w,8};};
struct r24 {
 unsigned d{};
 struct Word {unsigned&v;operator std::uint16_t()const{return std::uint16_t(v);}Word&operator=(const Word&q){return *this=unsigned(q); }Word&operator=(unsigned q){v=(v&0xff0000)|(q&65535);return *this;}unsigned operator++(int){unsigned old=v&65535;*this=old+1;return old;}unsigned operator--(int){unsigned old=v&65535;*this=old-1;return old;}Word&operator--(){*this=unsigned(*this)-1;return *this;}}w{d};
 struct Byte {unsigned&v;unsigned shift;operator n8()const{return n8(v>>shift);}Byte&operator=(unsigned q){v=(v&~(255u<<shift))|((q&255)<<shift);return *this;}}l{d,0},h{d,8},b{d,16};
};
class AresStackReference {public:
 bool EF{},ZF{},NF{},fetching{};StackWord S{},D{},X{};r24 PC{},U{},V{},W{};
 std::array<n8,65536> memory{};std::vector<BusEvent> events;
 n8 read(u32 address){auto value=memory[address&65535];if(!fetching)events.push_back({'r',address,value});return value;}
 void write(u32 address,n8 value){events.push_back({'w',address,value});if(address<8192)memory[address]=value;}
 void idle(){}void idle2(){}void idleJump(){}
 n8 fetch(){fetching=true;auto q=read((unsigned(PC.b)<<16)|PC.w++);fetching=false;return q;}
 auto pushN(n8 data)->void;auto pullN()->n8;auto readDirectN(u32 address)->n8;auto push(n8 data)->void;auto pull()->n8;
 auto instructionPushD()->void;auto instructionPullD()->void;
 auto instructionPushEffectiveAddress()->void;auto instructionPushEffectiveIndirectAddress()->void;auto instructionPushEffectiveRelativeAddress()->void;
 auto instructionCallLong()->void;auto instructionCallIndexedIndirect()->void;auto instructionReturnLong()->void;auto instructionReturnShort()->void;
};
using i16=std::int16_t;
#define L
#define E if(EF)
auto AresStackReference::pushN(n8 data) -> void {
  write(S.w--, data);
}

auto AresStackReference::pullN() -> n8 {
  return read(++S.w);
}

auto AresStackReference::readDirectN(u32 address) -> n8 {
  return read(n16(D.w + address));
}

auto AresStackReference::push(n8 data) -> void {
  write(S.w, data);
  EF ? (void)S.l-- : (void)S.w--;
}

auto AresStackReference::pull() -> n8 {
  EF ? (void)S.l++ : (void)S.w++;
  return read(S.w);
}

auto AresStackReference::instructionPushD() -> void {
  idle();
  pushN(D.h);
L pushN(D.l);
E S.h = 0x01;
}

auto AresStackReference::instructionPullD() -> void {
  idle();
  idle();
  D.l = pullN();
L D.h = pullN();
  ZF = D.w == 0;
  NF = D.w & 0x8000;
E S.h = 0x01;
}

auto AresStackReference::instructionPushEffectiveAddress() -> void {
  W.l = fetch();
  W.h = fetch();
  pushN(W.h);
L pushN(W.l);
E S.h = 0x01;
}

auto AresStackReference::instructionPushEffectiveIndirectAddress() -> void {
  U.l = fetch();
  idle2();
  W.l = readDirectN(U.l + 0);
  W.h = readDirectN(U.l + 1);
  pushN(W.h);
L pushN(W.l);
E S.h = 0x01;
}

auto AresStackReference::instructionPushEffectiveRelativeAddress() -> void {
  V.l = fetch();
  V.h = fetch();
  idle();
  W.w = PC.d + (i16)V.w;
  pushN(W.h);
L pushN(W.l);
E S.h = 0x01;
}

auto AresStackReference::instructionCallLong() -> void {
  V.l = fetch();
  V.h = fetch();
  pushN(PC.b);
  idle();
  V.b = fetch();
  PC.w--;
  pushN(PC.h);
L pushN(PC.l);
  PC.d = V.d;
E S.h = 0x01;
  idleJump();
}

auto AresStackReference::instructionCallIndexedIndirect() -> void {
  V.l = fetch();
  pushN(PC.h);
  pushN(PC.l);
  V.h = fetch();
  idle();
  W.l = read(PC.b << 16 | n16(V.w + X.w + 0));
L W.h = read(PC.b << 16 | n16(V.w + X.w + 1));
  PC.w = W.w;
E S.h = 0x01;
  idleJump();
}

auto AresStackReference::instructionReturnLong() -> void {
  idle();
  idle();
  V.l = pullN();
  V.h = pullN();
L V.b = pullN();
  PC.d = V.d;
  PC.w++;
E S.h = 0x01;
  idleJump();
}

auto AresStackReference::instructionReturnShort() -> void {
  idle();
  idle();
  W.l = pull();
  W.h = pull();
L idle();
  PC.w = W.w;
  PC.w++;
  idleJump();
}
#undef E
#undef L
}
