// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
const rom=F.loadRom(F.makeSyntheticRom(),'v026.sfc'),a=F.analyze(rom,1024),p=F.generateProject(rom,a);
ok(/^0\.(?:2|3|4)\./.test(F.VERSION)||F.VERSION.startsWith('0.4.'),'familia v0.2+/v0.3.x ausente');
ok(a.renderer.includes('PPU_LATCH_VRAM_REMAP'),'renderer fidelity nao anunciado');
ok(a.hdma.includes('MASTER_CYCLE_HBLANK_1106_MIDFRAME_MASK') || a.hdma.includes('REPEAT_FIXED'),'HDMA repeat/midframe fix nao anunciado');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v026-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});
fs.writeFileSync(path.join(dir,'src','runtime.hpp'),p['src/runtime.hpp']);
fs.writeFileSync(path.join(dir,'v026_test.cpp'),`#include "src/runtime.hpp"
#include <cassert>
int main(){
  PpuState p;
  // Shared BG scroll latch: two writes reconstruct the expected 16-bit value.
  p.write(0x210D,0x34);p.write(0x210D,0x12);assert(p.scrollX[0]==0x1234);
  p.write(0x210E,0x78);p.write(0x210E,0x56);assert(p.scrollY[0]==0x5678);
  // Mode7 uses the shared latch across different registers.
  PpuState m;m.write(0x211B,0x34);m.write(0x211C,0x12);assert(m.m7[0]==0x3400);assert(m.m7[1]==0x1234);
  // VMAIN full-graphic remap (mode 1: count 32, shift 5).
  PpuState v;v.write(0x2115,0x04);v.write(0x2116,0x21);v.write(0x2117,0x00);auto word=v.vramMappedWord();unsigned rem=0x21u&255u;unsigned expected=(0x21u&~255u)+(rem>>5)+((rem&31u)<<3);assert(word==expected);v.write(0x2118,0xAA);assert(v.vram[(expected*2u)&0xFFFFu]==0xAA);
  // VRAM read buffer is preloaded when VMADD is written.
  PpuState r;r.vram[0x20]=0x5A;r.vram[0x21]=0xA5;r.write(0x2116,0x10);r.write(0x2117,0);assert(r.read(0x2139)==0x5A);assert(r.read(0x213A)==0xA5);
  // CGRAM writes commit on the second byte and advance one palette entry.
  PpuState c;c.write(0x2121,2);c.write(0x2122,0x1F);assert(c.cgram[4]==0);c.write(0x2122,0x83);assert(c.cgram[4]==0x1F&&c.cgram[5]==0x03&&c.cgAddr==3);c.write(0x2121,2);assert(c.read(0x213B)==0x1F);assert(c.read(0x213B)==0x03);assert(c.cgAddr==3);
  // OAM low table uses a two-byte latch; high table is addressed through 0x100..0x10F words.
  PpuState o;o.write(0x2102,0);o.write(0x2103,0);o.write(0x2104,0x11);assert(o.oam[0]==0);o.write(0x2104,0x22);assert(o.oam[0]==0x11&&o.oam[1]==0x22&&o.oamAddr==1);o.write(0x2102,0);o.write(0x2103,1);o.write(0x2104,0x33);o.write(0x2104,0x44);assert(o.oam[512]==0x33&&o.oam[513]==0x44);
  // HDMA descriptor bit 7 means transfer every line; clear means transfer first line only.
  SnesRuntime h;h.dma[0].a1b=0x7E;h.dma[0].a1t=0x0100;h.dma[0].bbad=0;h.dma[0].dmap=0;h.ram[0x100]=0x82;h.ram[0x101]=0x0E;h.ram[0x102]=0x07;h.ram[0x103]=0;h.initializeHdma(1);h.executeHdmaLine();assert(h.ppu.brightness==0x0E);h.executeHdmaLine();assert(h.ppu.brightness==0x07);
  SnesRuntime h2;h2.dma[0].a1b=0x7E;h2.dma[0].a1t=0x0100;h2.dma[0].bbad=0;h2.dma[0].dmap=0;h2.ram[0x100]=0x02;h2.ram[0x101]=0x0D;h2.ram[0x102]=0x06;h2.ram[0x103]=0;h2.initializeHdma(1);h2.executeHdmaLine();assert(h2.ppu.brightness==0x0D);h2.executeHdmaLine();assert(h2.ppu.brightness==0x0D);
  // Standard HiROM low half in system banks is not cartridge ROM.
  SnesRuntime hm;hm.mapper=MapperKind::HiROM;hm.cart.resize(0x200000);assert(hm.romOffset(0x001000)==(std::size_t)-1);assert(hm.romOffset(0x008000)!=(std::size_t)-1);assert(hm.romOffset(0x401000)!=(std::size_t)-1);
  return 0;
}`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'v026_test.cpp'),'-o',path.join(dir,'v026_test')],{stdio:'inherit'});cp.execFileSync(path.join(dir,'v026_test'),[],{stdio:'inherit'});
console.log('Snes9x reference fidelity v0.2.6 regression: PASS',{renderer:a.renderer,hdma:a.hdma});
