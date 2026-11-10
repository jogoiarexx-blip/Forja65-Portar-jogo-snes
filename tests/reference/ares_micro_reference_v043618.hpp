#pragma once
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
// Test-only micro-adapter. Original method bodies from ares 9408cb43d4948fc3ea6e152a307a34348df3fe04.
// Copyright (c) 2004-2025 ares team, Near et al. ISC notice: docs/references/ARES-ISC-NOTICE.txt.
// Adapter/types are Forja65 test infrastructure; no emulator frontend, scheduler or DSP is linked.
#include <array>
#include <bit>
#include <cstdint>
#include <stdexcept>
namespace upstream_ares_reference {
using n8=std::uint8_t;using u32=std::uint32_t;
struct n16 {std::uint16_t value{};n16()=default;n16(unsigned v):value(std::uint16_t(v)){};operator std::uint16_t()const{return value;}unsigned bit(unsigned a,unsigned b)const{return(value>>a)&((1u<<(b-a+1))-1u);}n8 byte(unsigned b)const{return n8(value>>(b*8));}n16&operator+=(unsigned q){value=std::uint16_t(value+q);return *this;}};
struct WordMemory{std::array<n16,32768> data{};n16&operator[](unsigned a){return data[a&32767];}};
class AresPpuReference {public:
 struct{n16 vramAddress{};unsigned vramMapping{},vramIncrementSize{1};bool displayDisable{true},vramIncrementMode{};}io;
 struct{n16 vram{};}latch;struct{n8 mdr{};}ppu1;WordMemory vram;unsigned line{225};
 unsigned vcounter()const{return line;}unsigned vdisp()const{return 225;}
 auto addressVRAM()const->n16;auto readVRAM()->n16;
 n8 read(unsigned address){switch(address){
case 0x2139: {
    ppu1.mdr = latch.vram.byte(0);
    if(io.vramIncrementMode == 0) {
      latch.vram = readVRAM();
      io.vramAddress += io.vramIncrementSize;
    }
    return ppu1.mdr;
  }
case 0x213a: {
    ppu1.mdr = latch.vram.byte(1);
    if(io.vramIncrementMode == 1) {
      latch.vram = readVRAM();
      io.vramAddress += io.vramIncrementSize;
    }
    return ppu1.mdr;
  }
 default:throw std::invalid_argument("micro-reference supports 2139/213A only");}}
 void write(unsigned address,n8 value){switch(address){
 case 0x2100:io.displayDisable=(value&128)!=0;break;
 case 0x2115:{static const unsigned steps[]={1,32,128,128};io.vramMapping=(value>>2)&3;io.vramIncrementSize=steps[value&3];io.vramIncrementMode=(value&128)!=0;break;}
 case 0x2116:io.vramAddress=n16((unsigned(io.vramAddress)&0xff00)|value);latch.vram=readVRAM();break;
 case 0x2117:io.vramAddress=n16((unsigned(io.vramAddress)&255)|(unsigned(value)<<8));latch.vram=readVRAM();break;
 default:throw std::invalid_argument("unsupported micro-reference write");}}
};
#define unreachable throw std::logic_error("invalid VRAM remap")
inline auto AresPpuReference::addressVRAM() const -> n16 {
  n16 address = io.vramAddress;
  switch(io.vramMapping) {
  case 0: return address;
  case 1: return address.bit( 8,15) <<  8 | address.bit(0,4) << 3 | address.bit(5,7);
  case 2: return address.bit( 9,15) <<  9 | address.bit(0,5) << 3 | address.bit(6,8);
  case 3: return address.bit(10,15) << 10 | address.bit(0,6) << 3 | address.bit(7,9);
  }
  unreachable;
}
inline auto AresPpuReference::readVRAM() -> n16 {
  if(!io.displayDisable && vcounter() < vdisp()) return 0x0000;
  auto address = addressVRAM();
  return vram[address];
}
#undef unreachable
// This narrow adapter exposes instructionPullB and pointer-byte reads, not cycle equivalence.
struct r16 {std::uint16_t w{};struct Byte {std::uint16_t&word;unsigned shift;operator n8()const{return n8(word>>shift);}Byte&operator=(unsigned v){word=std::uint16_t((word&~(255u<<shift))|((v&255u)<<shift));return *this;}};Byte l{w,0},h{w,8};};
static_assert(std::endian::native==std::endian::little,"CPU micro-adapter requires little endian");
class AresCpuReference{public:
 bool EF{},ZF{},NF{};r16 S{},D{};n8 B{};std::array<n8,65536> memory{};
 n8 read(u32 address){return memory[address&0xffff];}void idle(){}
 auto pullN()->n8;auto readDirect(u32 address)->n8;auto readDirectX(u32 address,u32 offset)->n8;auto instructionPullB()->void;
};
inline auto AresCpuReference::pullN() -> n8 {
  return read(++S.w);
}
inline auto AresCpuReference::readDirect(u32 address) -> n8 {
  if(EF && !D.l) return read(D.w | n8(address));
  return read(n16(D.w + address));
}
inline auto AresCpuReference::readDirectX(u32 address, u32 offset) -> n8 {
  // The (direct,X) addressing mode has a bug in which the high byte is
  // wrapped within the page if E = 1 and D&0xFF != 0.
  if(EF && D.l) return read(((D.w + address) & 0xffff00) | n8(D.w + address + offset));
  else return readDirect(address + offset);
}
#define L
#define E if(EF)
auto AresCpuReference::instructionPullB() -> void {
  idle();
  idle();
L B = pullN();
  ZF = B == 0;
  NF = B & 0x80;
E S.h = 0x01;
}
#undef L
#undef E
}
