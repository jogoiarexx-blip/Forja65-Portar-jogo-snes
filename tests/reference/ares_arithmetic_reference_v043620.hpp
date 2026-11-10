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
// Selected algorithms from ares 9408cb43d4948fc3ea6e152a307a34348df3fe04.
// Test-only adapter; idle/bus/cycles are outside this arithmetic oracle.
#include "ares_micro_reference_v043618.hpp"
namespace upstream_ares_reference {
using s32=std::int32_t;
class AresArithmeticReference {public:
 r16 A{};bool DF{},CF{},VF{},ZF{},NF{};
 auto algorithmADC8(n8 data)->n8;auto algorithmADC16(n16 data)->n16;
 auto algorithmSBC8(n8 data)->n8;auto algorithmSBC16(n16 data)->n16;
};
auto AresArithmeticReference::algorithmADC8(n8 data) -> n8 {
  s32 result;

  if(!DF) {
    result = A.l + data + CF;
  } else {
    result = (A.l & 0x0f) + (data & 0x0f) + (CF << 0);
    if(result > 0x09) result += 0x06;
    CF = result > 0x0f;
    result = (A.l & 0xf0) + (data & 0xf0) + (CF << 4) + (result & 0x0f);
  }

  VF = ~(A.l ^ data) & (A.l ^ result) & 0x80;
  if(DF && result > 0x9f) result += 0x60;
  CF = result > 0xff;
  ZF = (n8)result == 0;
  NF = result & 0x80;

  return A.l = result;
}

auto AresArithmeticReference::algorithmADC16(n16 data) -> n16 {
  s32 result;

  if(!DF) {
    result = A.w + data + CF;
  } else {
    result = (A.w & 0x000f) + (data & 0x000f) + (CF <<  0);
    if(result > 0x0009) result += 0x0006;
    CF = result > 0x000f;
    result = (A.w & 0x00f0) + (data & 0x00f0) + (CF <<  4) + (result & 0x000f);
    if(result > 0x009f) result += 0x0060;
    CF = result > 0x00ff;
    result = (A.w & 0x0f00) + (data & 0x0f00) + (CF <<  8) + (result & 0x00ff);
    if(result > 0x09ff) result += 0x0600;
    CF = result > 0x0fff;
    result = (A.w & 0xf000) + (data & 0xf000) + (CF << 12) + (result & 0x0fff);
  }

  VF = ~(A.w ^ data) & (A.w ^ result) & 0x8000;
  if(DF && result > 0x9fff) result += 0x6000;
  CF = result > 0xffff;
  ZF = (n16)result == 0;
  NF = result & 0x8000;

  return A.w = result;
}

auto AresArithmeticReference::algorithmSBC8(n8 data) -> n8 {
  s32 result;
  data = ~data;

  if(!DF) {
    result = A.l + data + CF;
  } else {
    result = (A.l & 0x0f) + (data & 0x0f) + (CF << 0);
    if(result <= 0x0f) result -= 0x06;
    CF = result > 0x0f;
    result = (A.l & 0xf0) + (data & 0xf0) + (CF << 4) + (result & 0x0f);
  }

  VF = ~(A.l ^ data) & (A.l ^ result) & 0x80;
  if(DF && result <= 0xff) result -= 0x60;
  CF = result > 0xff;
  ZF = (n8)result == 0;
  NF = result & 0x80;

  return A.l = result;
}

auto AresArithmeticReference::algorithmSBC16(n16 data) -> n16 {
  s32 result;
  data = ~data;

  if(!DF) {
    result = A.w + data + CF;
  } else {
    result = (A.w & 0x000f) + (data & 0x000f) + (CF <<  0);
    if(result <= 0x000f) result -= 0x0006;
    CF = result > 0x000f;
    result = (A.w & 0x00f0) + (data & 0x00f0) + (CF <<  4) + (result & 0x000f);
    if(result <= 0x00ff) result -= 0x0060;
    CF = result > 0x00ff;
    result = (A.w & 0x0f00) + (data & 0x0f00) + (CF <<  8) + (result & 0x00ff);
    if(result <= 0x0fff) result -= 0x0600;
    CF = result > 0x0fff;
    result = (A.w & 0xf000) + (data & 0xf000) + (CF << 12) + (result & 0x0fff);
  }

  VF = ~(A.w ^ data) & (A.w ^ result) & 0x8000;
  if(DF && result <= 0xffff) result -= 0x6000;
  CF = result > 0xffff;
  ZF = (n16)result == 0;
  NF = result & 0x8000;

  return A.w = result;
}
}
