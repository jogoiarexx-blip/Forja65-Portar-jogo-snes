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
// Test-only bodies from ares 9408cb43d4948fc3ea6e152a307a34348df3fe04.
// CPU data accesses and ALU are independent; memory/peripheral bus is shared
// with a second SnesRuntime. This does not verify PPU accuracy or cycle timing.
#include "runtime.hpp"
#include <array>
#include <vector>
namespace upstream_ares_rmw {
using n8=std::uint8_t;using n16=std::uint16_t;using u32=std::uint32_t;
struct r16 {
 n16 w{};
 struct Byte {n16& word;unsigned shift;operator n8()const{return n8(word>>shift);}Byte&operator=(unsigned value){word=n16((word&~(255u<<shift))|((value&255u)<<shift));return *this;}};
 Byte l{w,0},h{w,8};r16()=default;r16(const r16& other):w(other.w){}
};
struct Event{char kind;u32 address;unsigned value;bool operator==(const Event&)const=default;};
class AresRmwReference {public:
 using alu8=n8(AresRmwReference::*)(n8);using alu16=n16(AresRmwReference::*)(n16);
 explicit AresRmwReference(SnesRuntime& bus):bus(bus){}
 SnesRuntime&bus;std::vector<Event> events;std::array<n8,65536> code{};n16 pc{};
 r16 A{},D{},X{},U{},V{},W{};n8 B{};bool EF{},CF{},ZF{},NF{};
 n8 fetch(){return code[pc++];}void idle(){}void idle2(){}
 n8 read(u32 a){a&=0xffffffu;auto v=n8(bus.read(a));events.push_back({'r',a,v});return v;}
 void write(u32 a,n8 v){a&=0xffffffu;bus.write8(a,v);events.push_back({'w',a,v});}
 n8 readBank(u32 a){return read((u32(B)<<16)+a);}void writeBank(u32 a,n8 v){write((u32(B)<<16)+a,v);}
 auto algorithmASL8(n8 data) -> n8;
 auto algorithmASL16(n16 data) -> n16;
 auto algorithmDEC8(n8 data) -> n8;
 auto algorithmDEC16(n16 data) -> n16;
 auto algorithmINC8(n8 data) -> n8;
 auto algorithmINC16(n16 data) -> n16;
 auto algorithmLSR8(n8 data) -> n8;
 auto algorithmLSR16(n16 data) -> n16;
 auto algorithmROL8(n8 data) -> n8;
 auto algorithmROL16(n16 data) -> n16;
 auto algorithmROR8(n8 data) -> n8;
 auto algorithmROR16(n16 data) -> n16;
 auto algorithmTRB8(n8 data) -> n8;
 auto algorithmTRB16(n16 data) -> n16;
 auto algorithmTSB8(n8 data) -> n8;
 auto algorithmTSB16(n16 data) -> n16;
 auto instructionBankModify8(alu8 op) -> void;
 auto instructionBankModify16(alu16 op) -> void;
 auto instructionBankIndexedModify8(alu8 op) -> void;
 auto instructionBankIndexedModify16(alu16 op) -> void;
 auto instructionDirectModify8(alu8 op) -> void;
 auto instructionDirectModify16(alu16 op) -> void;
 auto instructionDirectIndexedModify8(alu8 op) -> void;
 auto instructionDirectIndexedModify16(alu16 op) -> void;
 auto instructionBankWrite8(r16 F) -> void;
 auto instructionBankWrite16(r16 F) -> void;
 auto instructionDirectWrite8(r16 F) -> void;
 auto instructionDirectWrite16(r16 F) -> void;
 auto readDirect(u32 address) -> n8;
 auto writeDirect(u32 address, n8 data) -> void;
 void run(unsigned op,unsigned kind,bool wide,bool store=false){
  if(store){if(kind==0){if(wide)instructionBankWrite16(A);else instructionBankWrite8(A);}else{if(wide)instructionDirectWrite16(A);else instructionDirectWrite8(A);}return;}
  static const alu8 ops8[]={&AresRmwReference::algorithmINC8,&AresRmwReference::algorithmDEC8,&AresRmwReference::algorithmASL8,&AresRmwReference::algorithmLSR8,&AresRmwReference::algorithmROL8,&AresRmwReference::algorithmROR8,&AresRmwReference::algorithmTSB8,&AresRmwReference::algorithmTRB8};
  static const alu16 ops16[]={&AresRmwReference::algorithmINC16,&AresRmwReference::algorithmDEC16,&AresRmwReference::algorithmASL16,&AresRmwReference::algorithmLSR16,&AresRmwReference::algorithmROL16,&AresRmwReference::algorithmROR16,&AresRmwReference::algorithmTSB16,&AresRmwReference::algorithmTRB16};
  if(wide){auto op16=ops16[op];switch(kind){case 0:instructionBankModify16(op16);break;case 1:instructionBankIndexedModify16(op16);break;case 2:instructionDirectModify16(op16);break;case 3:instructionDirectIndexedModify16(op16);break;}}
  else{auto op8=ops8[op];switch(kind){case 0:instructionBankModify8(op8);break;case 1:instructionBankIndexedModify8(op8);break;case 2:instructionDirectModify8(op8);break;case 3:instructionDirectIndexedModify8(op8);break;}}
 }
};
#define L
#define alu(...) (this->*op)(__VA_ARGS__)
auto AresRmwReference::algorithmASL8(n8 data) -> n8 {
  CF = data & 0x80;
  data <<= 1;
  ZF = data == 0;
  NF = data & 0x80;
  return data;
}

auto AresRmwReference::algorithmASL16(n16 data) -> n16 {
  CF = data & 0x8000;
  data <<= 1;
  ZF = data == 0;
  NF = data & 0x8000;
  return data;
}

auto AresRmwReference::algorithmDEC8(n8 data) -> n8 {
  data--;
  ZF = data == 0;
  NF = data & 0x80;
  return data;
}

auto AresRmwReference::algorithmDEC16(n16 data) -> n16 {
  data--;
  ZF = data == 0;
  NF = data & 0x8000;
  return data;
}

auto AresRmwReference::algorithmINC8(n8 data) -> n8 {
  data++;
  ZF = data == 0;
  NF = data & 0x80;
  return data;
}

auto AresRmwReference::algorithmINC16(n16 data) -> n16 {
  data++;
  ZF = data == 0;
  NF = data & 0x8000;
  return data;
}

auto AresRmwReference::algorithmLSR8(n8 data) -> n8 {
  CF = data & 1;
  data >>= 1;
  ZF = data == 0;
  NF = data & 0x80;
  return data;
}

auto AresRmwReference::algorithmLSR16(n16 data) -> n16 {
  CF = data & 1;
  data >>= 1;
  ZF = data == 0;
  NF = data & 0x8000;
  return data;
}

auto AresRmwReference::algorithmROL8(n8 data) -> n8 {
  bool carry = CF;
  CF = data & 0x80;
  data = data << 1 | carry;
  ZF = data == 0;
  NF = data & 0x80;
  return data;
}

auto AresRmwReference::algorithmROL16(n16 data) -> n16 {
  bool carry = CF;
  CF = data & 0x8000;
  data = data << 1 | carry;
  ZF = data == 0;
  NF = data & 0x8000;
  return data;
}

auto AresRmwReference::algorithmROR8(n8 data) -> n8 {
  bool carry = CF;
  CF = data & 1;
  data = carry << 7 | data >> 1;
  ZF = data == 0;
  NF = data & 0x80;
  return data;
}

auto AresRmwReference::algorithmROR16(n16 data) -> n16 {
  bool carry = CF;
  CF = data & 1;
  data = carry << 15 | data >> 1;
  ZF = data == 0;
  NF = data & 0x8000;
  return data;
}

auto AresRmwReference::algorithmTRB8(n8 data) -> n8 {
  ZF = (data & A.l) == 0;
  data &= ~A.l;
  return data;
}

auto AresRmwReference::algorithmTRB16(n16 data) -> n16 {
  ZF = (data & A.w) == 0;
  data &= ~A.w;
  return data;
}

auto AresRmwReference::algorithmTSB8(n8 data) -> n8 {
  ZF = (data & A.l) == 0;
  data |= A.l;
  return data;
}

auto AresRmwReference::algorithmTSB16(n16 data) -> n16 {
  ZF = (data & A.w) == 0;
  data |= A.w;
  return data;
}

auto AresRmwReference::instructionBankModify8(alu8 op) -> void {
  V.l = fetch();
  V.h = fetch();
  W.l = readBank(V.w + 0);
  idle();
  W.l = alu(W.l);
L writeBank(V.w + 0, W.l);
}

auto AresRmwReference::instructionBankModify16(alu16 op) -> void {
  V.l = fetch();
  V.h = fetch();
  W.l = readBank(V.w + 0);
  W.h = readBank(V.w + 1);
  idle();
  W.w = alu(W.w);
  writeBank(V.w + 1, W.h);
L writeBank(V.w + 0, W.l);
}

auto AresRmwReference::instructionBankIndexedModify8(alu8 op) -> void {
  V.l = fetch();
  V.h = fetch();
  idle();
  W.l = readBank(V.w + X.w + 0);
  idle();
  W.l = alu(W.l);
L writeBank(V.w + X.w + 0, W.l);
}

auto AresRmwReference::instructionBankIndexedModify16(alu16 op) -> void {
  V.l = fetch();
  V.h = fetch();
  idle();
  W.l = readBank(V.w + X.w + 0);
  W.h = readBank(V.w + X.w + 1);
  idle();
  W.w = alu(W.w);
  writeBank(V.w + X.w + 1, W.h);
L writeBank(V.w + X.w + 0, W.l);
}

auto AresRmwReference::instructionDirectModify8(alu8 op) -> void {
  U.l = fetch();
  idle2();
  W.l = readDirect(U.l + 0);
  idle();
  W.l = alu(W.l);
L writeDirect(U.l + 0, W.l);
}

auto AresRmwReference::instructionDirectModify16(alu16 op) -> void {
  U.l = fetch();
  idle2();
  W.l = readDirect(U.l + 0);
  W.h = readDirect(U.l + 1);
  idle();
  W.w = alu(W.w);
  writeDirect(U.l + 1, W.h);
L writeDirect(U.l + 0, W.l);
}

auto AresRmwReference::instructionDirectIndexedModify8(alu8 op) -> void {
  U.l = fetch();
  idle2();
  idle();
  W.l = readDirect(U.l + X.w + 0);
  idle();
  W.l = alu(W.l);
L writeDirect(U.l + X.w + 0, W.l);
}

auto AresRmwReference::instructionDirectIndexedModify16(alu16 op) -> void {
  U.l = fetch();
  idle2();
  idle();
  W.l = readDirect(U.l + X.w + 0);
  W.h = readDirect(U.l + X.w + 1);
  idle();
  W.w = alu(W.w);
  writeDirect(U.l + X.w + 1, W.h);
L writeDirect(U.l + X.w + 0, W.l);
}

auto AresRmwReference::instructionBankWrite8(r16 F) -> void {
  V.l = fetch();
  V.h = fetch();
L writeBank(V.w + 0, F.l);
}

auto AresRmwReference::instructionBankWrite16(r16 F) -> void {
  V.l = fetch();
  V.h = fetch();
  writeBank(V.w + 0, F.l);
L writeBank(V.w + 1, F.h);
}

auto AresRmwReference::instructionDirectWrite8(r16 F) -> void {
  U.l = fetch();
  idle2();
L writeDirect(U.l + 0, F.l);
}

auto AresRmwReference::instructionDirectWrite16(r16 F) -> void {
  U.l = fetch();
  idle2();
  writeDirect(U.l + 0, F.l);
L writeDirect(U.l + 1, F.h);
}

inline auto AresRmwReference::readDirect(u32 address) -> n8 {
  if(EF && !D.l) return read(D.w | n8(address));
  return read(n16(D.w + address));
}

inline auto AresRmwReference::writeDirect(u32 address, n8 data) -> void {
  if(EF && !D.l) return write(D.w | n8(address), data);
  write(n16(D.w + address), data);
}
#undef alu
#undef L
}
