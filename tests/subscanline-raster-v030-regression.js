// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
ok(/^(?:0\.3\.|0\.4\.)/.test(F.VERSION),'familia v0.3.x ausente');
const rom=F.loadRom(require('./fixtures/bootable-rom')(),'v030.sfc'),a=F.analyze(rom,1024),p=F.generateProject(rom,a);
ok(a.renderer.includes('SUBSCANLINE'),'renderer subscanline nao anunciado');
ok(a.hdma.includes('SUBSCANLINE'),'HDMA/subscanline nao anunciado');
for(const q of ['renderOutputSegment','renderVisibleUntilMasterCycle','finishVisibleLine','rasterLogicalXFromMasterCycle','rasterCursorX'])
  ok(p['src/runtime.hpp'].includes(q),'runtime sem '+q);
ok(p['src/runtime.hpp'].includes('clip((unsigned)irqev)'),'scheduler nao divide timing no IRQ');
ok(p['analysis.json'].includes('"subscanline_raster": true'),'analysis sem flag subscanline');

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v030-'));
fs.mkdirSync(path.join(dir,'src'),{recursive:true});
fs.writeFileSync(path.join(dir,'src','runtime.hpp'),p['src/runtime.hpp']);
fs.writeFileSync(path.join(dir,'v030_test.cpp'),`#include "src/runtime.hpp"
#include <cassert>
#include <cstdint>
int main(){
  SnesRuntime hw;
  hw.ppu.inidisp=0x0F; hw.ppu.forceBlank=false; hw.ppu.brightness=15;
  hw.ppu.cgram[0]=0xFF; hw.ppu.cgram[1]=0x7F;
  hw.beginFrame(); hw.beginScanline(0);
  assert(hw.fbWidth==256u);
  assert(hw.rasterLogicalXFromMasterCycle(414u)==100u);
  assert(hw.rasterOutputXFromMasterCycle(414u)==100u);
  hw.renderVisibleUntilMasterCycle(0,414u);
  auto before=hw.framebuffer[99];
  assert(before!=0xFF000000u);
  hw.ppu.inidisp=0x80; hw.ppu.forceBlank=true; hw.ppu.brightness=0;
  hw.finishVisibleLine(0);
  assert(hw.framebuffer[99]==before);
  assert(hw.framebuffer[100]==0xFF000000u);
  assert(hw.rasterCursorX==256u);

  SnesRuntime hh;
  hh.ppu.setini=0x08; hh.ppu.inidisp=0x0F; hh.ppu.forceBlank=false; hh.ppu.brightness=15;
  hh.ppu.cgram[0]=0xFF; hh.ppu.cgram[1]=0x7F;
  hh.beginFrame(); hh.beginScanline(0);
  assert(hh.fbWidth==512u);
  assert(hh.rasterOutputXFromMasterCycle(414u)==200u);
  hh.renderVisibleUntilMasterCycle(0,414u);
  auto hbefore=hh.framebuffer[199]; assert(hbefore!=0xFF000000u);
  hh.ppu.inidisp=0x80; hh.ppu.forceBlank=true; hh.ppu.brightness=0;
  hh.finishVisibleLine(0);
  assert(hh.framebuffer[199]==hbefore);
  assert(hh.framebuffer[200]==0xFF000000u);
  SnesRuntime irq;irq.ppu.inidisp=0x0F;irq.ppu.forceBlank=false;irq.ppu.brightness=15;irq.ppu.cgram[0]=0xFF;irq.ppu.cgram[1]=0x7F;
  irq.io.setNmitimen(0x10);irq.io.htime=100;irq.beginFrame();irq.beginScanline(0);
  irq.advanceCpuMasterCycles(410u);assert(irq.currentMasterCycle==414u);assert(irq.cpuIrqInterruptPending);
  irq.write8(0x2100u,0x80u);irq.finishVisibleLine(0);assert(irq.framebuffer[99]!=0xFF000000u);assert(irq.framebuffer[100]==0xFF000000u);
  return 0;
}
`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'v030_test.cpp'),'-o',path.join(dir,'v030_test')],{stdio:'inherit'});
cp.execFileSync(path.join(dir,'v030_test'),[],{stdio:'inherit'});
for(const [name,val] of Object.entries(p)){
  const qq=path.join(dir,'full',name);fs.mkdirSync(path.dirname(qq),{recursive:true});
  fs.writeFileSync(qq,val instanceof Uint8Array?Buffer.from(val):val);
}
cp.execFileSync('cmake',['-S',path.join(dir,'full'),'-B',path.join(dir,'full','build')],{stdio:'ignore'});
cp.execFileSync('cmake',['--build',path.join(dir,'full','build'),'-j','2'],{stdio:'ignore'});
const exe=path.join(dir,'full','build',process.platform==='win32'?'game.exe':'game');
cp.execFileSync(exe,[],{cwd:path.join(dir,'full','build'),stdio:'ignore'});
console.log('Subscanline raster v0.3.0 regression: PASS',{irq100:414,lowresSplit:100,hiresSplit:200});
