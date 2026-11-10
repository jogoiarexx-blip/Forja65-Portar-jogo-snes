// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
const rom=F.loadRom(require('./fixtures/bootable-rom')(),'v027.sfc'),a=F.analyze(rom,1024),p=F.generateProject(rom,a);
ok(/^0\.(?:2|3|4)\./.test(F.VERSION),'familia v0.2+/v0.3.x ausente');
ok(a.renderer.includes('PRIORITY_DIRECTCOLOR_EXTBG_HIRES_INTERLACE'),'renderer v0.2.7 nao anunciado');
ok(p['src/runtime.hpp'].includes('vis=visibleLines()'),'scheduler nao usa altura PPU dinamica');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v027-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});
fs.writeFileSync(path.join(dir,'src','runtime.hpp'),p['src/runtime.hpp']);
fs.writeFileSync(path.join(dir,'v027_test.cpp'),`#include "src/runtime.hpp"
#include <cassert>
static void set4(PpuState& p,unsigned base,unsigned tile,unsigned color){for(unsigned plane=0;plane<4;plane++)if(color&(1u<<plane))p.vram[(base+tile*32u+(plane>>1)*16u+(plane&1u))&0xFFFFu]=0x80;}
static void set8(PpuState& p,unsigned base,unsigned tile,unsigned color){for(unsigned plane=0;plane<8;plane++)if(color&(1u<<plane))p.vram[(base+tile*64u+(plane>>1)*16u+(plane&1u))&0xFFFFu]=0x80;}
int main(){
  // Mode 1: BG/OBJ priority must follow hardware depths, not draw order.
  PpuState q;q.brightness=15;q.bgmode=1;q.tm=0x11;q.bgsc[0]=4;q.bgnba[0]=1;q.cgram[2]=0x1F;q.cgram[3]=0;set4(q,0x2000,0,1);
  q.oam[0]=0;q.oam[1]=0;q.oam[2]=0;q.oam[3]=0x00;q.cgram[258]=0;q.cgram[259]=0x7C;set4(q,0,0,1);
  auto low=q.compose(0,0,false);assert(low.source==0&&low.priority==11);
  q.oam[3]=0x30;auto high=q.compose(0,0,false);assert(high.source==4&&high.priority==16);
  // OBSEL Name Select and tile high bit route OBJ graphics to the alternate base.
  PpuState os;os.brightness=15;os.obsel=0x08;os.oam[0]=0;os.oam[1]=0;os.oam[2]=0;os.oam[3]=0x01;os.cgram[258]=0x1F;set4(os,0x4000,0,1);auto sp=os.sampleSprites(0,0);assert(sp.valid&&sp.source==4);
  // Mode 3 direct color uses palette bits + 8bpp pixel instead of CGRAM.
  PpuState dc;dc.brightness=15;dc.bgmode=3;dc.bgsc[0]=4;dc.bgnba[0]=1;dc.cgwsel=1;dc.vram[0x800]=0;dc.vram[0x801]=(7u<<2);set8(dc,0x2000,0,0xE7);auto d=dc.sampleBg(0,0,0,8,0,false,true);assert(d.valid&&d.c15==dc.directColor15(7,0xE7));
  // Mode 7 EXTBG: high pixel bit is priority, lower 7 bits are color.
  PpuState ex;ex.brightness=15;ex.bgmode=7;ex.setini=0x40;ex.m7[0]=0x0100;ex.m7[3]=0x0100;ex.cgram[2]=0x1F;ex.vram[1]=0x81;auto e=ex.sampleMode7(1,0,0);assert(e.valid&&e.priority==11&&e.c15==ex.palette15(1));
  // Pseudo-hires and real hires modes produce a 512-pixel output surface.
  PpuState ph;ph.setini=0x08;assert(ph.outputWidth()==512&&ph.outputHeight()==224);auto pf=ph.renderNativeFrame();assert(pf.size()==512u*224u);
  PpuState h5;h5.bgmode=5;assert(h5.outputWidth()==512);
  // Interlace + overscan: 239 visible lines, two fields -> 478 output rows.
  PpuState il;il.setini=0x05;assert(il.visibleHeight()==239&&il.outputHeight()==478);
  return 0;
}`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'v027_test.cpp'),'-o',path.join(dir,'v027_test')],{stdio:'inherit'});cp.execFileSync(path.join(dir,'v027_test'),[],{stdio:'inherit'});
for(const [name,val] of Object.entries(p)){const q=path.join(dir,'full',name);fs.mkdirSync(path.dirname(q),{recursive:true});fs.writeFileSync(q,val instanceof Uint8Array?Buffer.from(val):val);}cp.execFileSync('cmake',['-S',path.join(dir,'full'),'-B',path.join(dir,'full','build')],{stdio:'ignore'});cp.execFileSync('cmake',['--build',path.join(dir,'full','build'),'-j','2'],{stdio:'ignore'});const exe=path.join(dir,'full','build',process.platform==='win32'?'game.exe':'game');cp.execFileSync(exe,[],{cwd:path.join(dir,'full','build'),stdio:'ignore'});
console.log('PPU priority/hires v0.2.7 regression: PASS',{renderer:a.renderer,widths:[256,512],interlaceRows:478});
