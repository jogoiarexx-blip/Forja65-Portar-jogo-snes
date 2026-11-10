// REV137: este teste exercita o comparador/pipeline de IRQ com linhas do port escolhidas a mao (VTIME == linha do port).
// A REV137 alinhou o contador V ao video (V = linha do port + 1); esse mapeamento e coberto por
// tests/dsp1-vcounter-v0436137-regression.js. Aqui o mapeamento antigo e fixado para o mecanismo continuar comparavel.
process.env.FORJA65_VCOUNTER_LEGACY='1';
// Reference: ares 9408cb43d4948fc3ea6e152a307a34348df3fe04, ares/sfc/cpu/{dma,irq,io,timing}.cpp.
// Pinned ares hdmaSetup resets completion and consumes the first descriptor at setup.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
ok(F.VERSION==='0.2.9-master-cycle-irq-hdma'||/^0\.(?:3|4)\./.test(F.VERSION),'base master-cycle ausente');

const rom=F.loadRom(require('./fixtures/bootable-rom')(),'v029.sfc'),a=F.analyze(rom,1024),p=F.generateProject(rom,a);
ok(a.hdma.includes('MASTER_CYCLE_HBLANK_1106_MIDFRAME_MASK'),'HDMA master-cycle nao anunciado');
ok(a.bootHardware.startsWith('MATH_WRAM_JOYSERIAL_MASTERIRQ'),'master IRQ nao anunciado');
for(const q of ['MASTER_CYCLES_PER_SCANLINE=1364u','HBLANK_START_MC=1096u','HDMA_START_MC=1106u','irqHMasterCycle','setHdmaEnable','hdmaEnded'])
  ok(p['src/runtime.hpp'].includes(q),'runtime sem '+q);
for(const q of ['HBLANK_START_MC','HDMA_START_MC','fireIrqAt'])
  ok(p['src/runtime.hpp'].includes(q),'scheduler runtime sem '+q);
ok(p['src/runtime.hpp'].includes('finishVisibleLine(currentScanline)'),'scheduler sem ponto de rasterizacao');

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v029-'));
fs.mkdirSync(path.join(dir,'src'),{recursive:true});
fs.writeFileSync(path.join(dir,'src','runtime.hpp'),p['src/runtime.hpp']);
fs.writeFileSync(path.join(dir,'v029_test.cpp'),`#include "src/runtime.hpp"
#include <cassert>
int main(){
  SnesRuntime hw;
  hw.io.htime=100; assert(hw.irqHMasterCycle()==414u);
  hw.io.htime=0; assert(hw.irqHMasterCycle()==10u);
  hw.io.htime=323; assert(hw.irqHMasterCycle()==1308u);
  hw.io.htime=327; assert(hw.irqHMasterCycle()==1326u);

  hw.io.setNmitimen(0x10); hw.io.htime=100; hw.beginScanline(7);
  assert(hw.irqEventMasterCycle(7)==414);
  assert(!hw.fireIrqAt(7,413));
  assert(hw.fireIrqAt(7,414));
  assert(hw.io.irqPending);
  assert(!hw.fireIrqAt(7,500));

  hw.io.irqPending=false; hw.io.setNmitimen(0x20); hw.io.vtime=5;
  hw.beginScanline(4); assert(hw.irqEventMasterCycle(4)<0);
  hw.beginScanline(5); assert(hw.irqEventMasterCycle(5)==14);
  assert(hw.fireIrqAt(5,14));

  hw.io.irqPending=false; hw.io.setNmitimen(0x30); hw.io.htime=20; hw.io.vtime=9;
  hw.beginScanline(8); assert(hw.irqEventMasterCycle(8)<0);
  hw.beginScanline(9); assert(hw.irqEventMasterCycle(9)==94);

  hw.beginScanline(0); assert(!hw.io.hblank);
  hw.setMasterCycle(0); assert(hw.io.hblank);
  hw.setMasterCycle(4); assert(!hw.io.hblank);
  hw.setMasterCycle(1095); assert(!hw.io.hblank);
  hw.setMasterCycle(1096); assert(hw.io.hblank);
  assert((hw.read(0x004212)&0x40u)!=0);

  hw.ram[0x1000]=0;
  hw.dma[0].a1b=0; hw.dma[0].a1t=0x1000;
  hw.io.hdmaen=1;hw.beginFrame(); assert(hw.hdmaActive==1);
  assert(!hw.hdmaSetupComplete);hw.advanceCpuMasterCycles(hw.hdmaSetupPosition);
  assert(hw.hdmaEnded&1u); assert((hw.hdmaActive&1u)==0);
  hw.setHdmaEnable(1);
  assert((hw.hdmaActive&1u)==0);
  hw.io.hdmaen=1;hw.beginFrame();
  assert(hw.hdmaEnded&1u);assert((hw.hdmaActive&1u)==0);assert(!hw.hdmaSetupComplete);

  hw.ram[0x1000]=0x82; hw.ram[0x1001]=0x0F; hw.ram[0x1002]=0x08; hw.ram[0x1003]=0;
  hw.ppu.inidisp=0x0F; hw.io.hdmaen=1;hw.beginFrame();hw.advanceCpuMasterCycles(hw.hdmaSetupPosition);
  assert((hw.hdmaEnded&1u)==0&&hw.hdmaActive==1);assert(hw.dma[0].a2a==0x1001&&hw.dma[0].ntrl==0x82);
  hw.executeHdmaLine();assert(hw.ppu.inidisp==0x0F&&hw.dma[0].ntrl==0x81&&hw.dma[0].a2a==0x1002);
  auto a2=hw.dma[0].a2a;
  hw.setHdmaEnable(0); assert(hw.hdmaActive==0);
  hw.setHdmaEnable(1); assert(hw.hdmaActive==1); assert(hw.dma[0].a2a==a2);

  return 0;
}
`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'v029_test.cpp'),'-o',path.join(dir,'v029_test')],{stdio:'inherit'});
cp.execFileSync(path.join(dir,'v029_test'),[],{stdio:'inherit'});

for(const [name,val] of Object.entries(p)){
  const q=path.join(dir,'full',name);fs.mkdirSync(path.dirname(q),{recursive:true});
  fs.writeFileSync(q,val instanceof Uint8Array?Buffer.from(val):val);
}
cp.execFileSync('cmake',['-S',path.join(dir,'full'),'-B',path.join(dir,'full','build')],{stdio:'ignore'});
cp.execFileSync('cmake',['--build',path.join(dir,'full','build'),'-j','2'],{stdio:'ignore'});
const exe=path.join(dir,'full','build',process.platform==='win32'?'game.exe':'game');
cp.execFileSync(exe,[],{cwd:path.join(dir,'full','build'),stdio:'ignore'});
console.log('Master-cycle IRQ/HDMA v0.2.9 regression: PASS',{irq100:414,hblank:1096,hdma:1106});
