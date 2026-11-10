const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const C=require('../forja65-core.js');
function assert(x,m){if(!x)throw new Error(m)}
// BRK vector should become a native CFG call.
const d=C.makeSyntheticRom();
d.set([0x00,0x00,0xA9,0x01,0x60],0); // BRK signature; LDA #1; RTS
// Native-mode/emulation BRK vector area mirrored in LoROM. Emulation vector is $FFFE.
d[0x7FFE]=0x20; d[0x7FFF]=0x80; d.set([0xE8,0x40],0x20); // INX; RTI
const rom=C.loadRom(d,'v017-brk.sfc'),a=C.analyze(rom,256);
assert(a.partial===0,'BRK/RTI nao deveriam permanecer partial nesta fixture');
assert(a.functions.some(f=>f.start===0x8020),'vetor BRK nao entrou no CFG');
assert(a.instructions.some(i=>i.mnemonic==='RTI'&&i.status==='native'),'RTI nao nativo');

const base=C.loadRom(C.makeSyntheticRom(),'runtime.sfc'),files=C.generateProject(base,C.analyze(base));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v017-'));fs.mkdirSync(path.join(dir,'src'));
fs.writeFileSync(path.join(dir,'src','runtime.hpp'),files['src/runtime.hpp']);
fs.writeFileSync(path.join(dir,'renderer_test.cpp'),`#include "src/runtime.hpp"\n#include <cassert>\nint main(){SnesRuntime hw;\n // BG1 Mode 1, palette 1 color red, tile 0 filled with color index 1.\n hw.write8(0x2100,0x0F);hw.write8(0x2105,0x01);hw.write8(0x2107,0x00);hw.write8(0x210B,0x01);hw.write8(0x212C,0x01);\n hw.ppu.cgram[2]=0x1F;hw.ppu.cgram[3]=0x00;for(int y=0;y<8;y++){hw.ppu.vram[0x2000+y*2]=0xFF;hw.ppu.vram[0x2001+y*2]=0;hw.ppu.vram[0x2010+y*2]=0;hw.ppu.vram[0x2011+y*2]=0;}\n auto f=hw.ppu.renderFrame(8,8);assert((f[0]&0x00FFFFFFu)==0x00FF0000u);\n // Sprite OAM basic, palette index 129 green.\n SnesRuntime sp;sp.write8(0x2100,0x0F);sp.write8(0x212C,0x10);sp.ppu.cgram[258]=0xE0;sp.ppu.cgram[259]=0x03;for(int y=0;y<8;y++){sp.ppu.vram[y*2]=0xFF;sp.ppu.vram[y*2+1]=0;sp.ppu.vram[16+y*2]=0;sp.ppu.vram[17+y*2]=0;}sp.ppu.oam[0]=0;sp.ppu.oam[1]=0;sp.ppu.oam[2]=0;sp.ppu.oam[3]=0;auto sf=sp.ppu.renderFrame(8,8);assert((sf[0]&0x00FFFFFFu)==0x0000FF00u);\n // HDMA direct mode 0: table sends $0F to INIDISP on first scanline.\n SnesRuntime hd;hd.write8(0x4300,0);hd.write8(0x4301,0);hd.write8(0x4302,0x00);hd.write8(0x4303,0x10);hd.write8(0x4304,0);hd.ram[0x1000]=1;hd.ram[0x1001]=0x0F;hd.ram[0x1002]=0;hd.write8(0x420C,1);hd.executeHdmaLine();assert(hd.ppu.inidisp==0x0F);hd.executeHdmaLine();assert(hd.hdmaActive==0);\n assert(hw.ppu.savePpm("${dir.replace(/\\/g,'\\\\')}/frame.ppm",8,8));return 0;}\n`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'renderer_test.cpp'),'-o',path.join(dir,'renderer_test')],{stdio:'inherit'});
cp.execFileSync(path.join(dir,'renderer_test'),[],{stdio:'inherit'});
assert(fs.statSync(path.join(dir,'frame.ppm')).size>20,'PPM nao gerado');
console.log('Renderer/HDMA v0.1.7 regression: PASS',{cfgFunctions:a.cfgFunctions,renderer:a.renderer,hdma:a.hdma});
