'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),C=require('../forja65-core');
const files=C.generateProject(C.loadRom(C.makeSyntheticRom()),C.analyze(C.loadRom(C.makeSyntheticRom()),128));
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-bg-tile-'));
// Counts actual VRAM reads in generated rendering code, only in this test copy.
let h=files['src/runtime.hpp'].replace('struct PpuState {','struct PpuState { mutable unsigned testBgReads{}; std::uint8_t testReadVram(unsigned a)const{testBgReads++;return vram[a];}');
for(const [begin,end] of [['  unsigned tilePixel2(', '  struct LayerPixel'],['  LayerPixel sampleBg(', '  LayerPixel sampleMode7(']]){
 const a=h.indexOf(begin),b=h.indexOf(end,a);h=h.slice(0,a)+h.slice(a,b).replace(/vram\[([^\]]+)\]/g,'testReadVram($1)')+h.slice(b);
}
fs.writeFileSync(path.join(d,'runtime.hpp'),h);fs.copyFileSync(path.join(__dirname,'fixtures/ppu-v034-reference.hpp'),path.join(d,'reference.hpp'));
fs.writeFileSync(path.join(d,'probe.cpp'),String.raw`#include "runtime.hpp"
#include "reference.hpp"
#include <cassert>
#include <iostream>
static unsigned seed=17;static unsigned rnd(){seed=seed*1664525u+1013904223u;return seed;}
template<class P>void init(P&p,unsigned n){seed=17+n;for(auto&b:p.vram)b=rnd()>>24;for(auto&b:p.cgram)b=rnd()>>24;for(auto&b:p.oam)b=rnd()>>24;
 p.brightness=15;p.bgmode=(n&7)|((n*73)&0xf0);p.mosaic=(n&7u)==7u?0:(n*29)&255;p.obsel=(n%8)<<5;p.tm=0x0f;p.ts=0x0f;p.setini=(n&8)?9:0;p.cgwsel=(n*19)&255;p.cgadsub=0;
 p.fixedR=p.cgram[0]&31u;p.fixedG=((p.cgram[0]|(p.cgram[1]<<8))>>5)&31u;p.fixedB=(p.cgram[1]>>2)&31u;p.w12sel=n*11;p.w34sel=n*7;p.wobjsel=n*13;p.wbglog=n*3;p.wobjlog=n;p.tmw=n;p.tsw=n*5;
 p.wh[0]=30;p.wh[1]=180;p.wh[2]=70;p.wh[3]=230;p.m7[0]=256;p.m7[3]=256;
 for(unsigned i=0;i<4;i++){p.bgsc[i]=(rnd()>>24);p.bgnba[i]=(rnd()>>24);p.scrollX[i]=rnd()&1023;p.scrollY[i]=rnd()&1023;}}
int main(){
 // Each 8-pixel 4bpp BG tile: 2 map bytes + 4 plane bytes; 32 tiles per row.
 PpuState p;p.brightness=15;p.bgmode=1;p.tm=1;p.bgsc[0]=4;std::vector<std::uint32_t>f;p.renderOutputSegment(f,0,0,256);
 std::cout<<"BG VRAM reads="<<p.testBgReads<<std::endl;assert(p.testBgReads<=192);
 // Hand-checked BG cache invalidation: red then green with scroll + tile writes.
 PpuState q;q.brightness=15;q.bgmode=1;q.tm=1;q.bgsc[0]=4;q.cgram[2]=31;q.vram[0]=255;
 std::vector<std::uint32_t>qf;q.renderOutputSegment(qf,0,0,4);assert(qf[0]==0xffff0000u);
 q.scrollX[0]=1;q.cgram[2]=0xe0;q.cgram[3]=3;q.vram[0]=4;q.renderOutputSegment(qf,0,4,8);
 assert(qf[4]==0xff00ff00u&&qf[5]==0xff000000u&&qf[0]==0xffff0000u);
 // Hand-checked mutation: OAM, tile data and CGRAM all change between segments.
 PpuState live;live.brightness=15;live.tm=0x10;for(unsigned i=1;i<128;i++)live.oam[i*4+1]=240;
 live.oam[0]=100;live.cgram[258]=31;live.vram[0]=255;std::vector<std::uint32_t> lf;live.renderOutputSegment(lf,0,0,64);
 live.oam[0]=80;live.cgram[258]=0xe0;live.cgram[259]=3;live.vram[0]=0x80;live.renderOutputSegment(lf,0,64,256);
 assert(lf[80]==0xff00ff00u&&lf[81]==0xff000000u&&lf[100]==0xff000000u);
 // Frozen BG reference: OBJ order and color math had confirmed bugs in the old
 // reference. Their corrected rules have dedicated regressions; do not restore
 // old bugs to make this BG tile-cache comparison pass. Modes/windows remain.
 // This is a cache-equivalence fixture, not a register-write oracle. Set the
 // independent Mode 7 registers to the old reference's direct scroll values.
 // Real shared-latch writes are tested by ppu-mode7-latch-v0433-regression.js.
 // The frozen reference predates BG3 offset-per-tile and correct hires
 // tile pairing/HOFS. Mode 5/6 now use the independent ares address oracle
 // in ppu-hires-address-rev161-regression.js. The remaining OPT modes are
 // verified with a separate generated-runtime pixel oracle in v0.4.36.4.
 // The frozen sampler also ignored Mode 7 MOSAIC entirely. Keep mosaic off
 // only in its Mode 7 scenes; REV162's independent clock/pixel oracle checks
 // enabled mosaic, mid-line writes and checkpoint continuation separately.
 for(unsigned n=0;n<128;n++){if((n&7u)==2u||(n&7u)==4u||(n&7u)==5u||(n&7u)==6u)continue;PpuState a;ReferencePpuState b;init(a,n);init(b,n);a.m7Hofs=a.scrollX[0];a.m7Vofs=a.scrollY[0];std::vector<std::uint32_t>x,y;
 for(int row:{0,7,31,111,223}){for(unsigned field:{0,1}){a.renderOutputScanline(x,row,field);b.renderOutputScanline(y,row,field);assert(x==y);}}
 // A mutation between segments must be visible immediately (no stale row cache).
 x.clear();y.clear();a.renderOutputSegment(x,7,0,73);b.renderOutputSegment(y,7,0,73);
 a.oam[1]=b.oam[1]=7;a.oam[0]=b.oam[0]=80;a.cgram[258]=b.cgram[258]=31;a.vram[0]=b.vram[0]=255;
 a.obsel=b.obsel=0;a.scrollX[0]=b.scrollX[0]=513;a.m7Hofs=513;a.mosaic=b.mosaic=(n&7u)==7u?0:0xf1;a.renderOutputSegment(x,7,73,a.outputWidth());b.renderOutputSegment(y,7,73,b.outputWidth());assert(x==y);
 }
 std::cout<<"BG tile equivalence: PASS (64 lowres non-OPT scenes, five rows, two fields, live segment mutations)\n";
}`);
cp.execFileSync('g++',['-std=c++20','-O2','-Wall','-Wextra','-Werror','probe.cpp','-o','probe'],{cwd:d});
cp.execFileSync(path.join(d,'probe'),[],{cwd:d,stdio:'inherit'});
