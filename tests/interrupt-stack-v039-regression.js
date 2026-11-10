// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
ok(/^0\.(?:3|4)\.\d+/.test(F.VERSION),'familia v0.3.x esperada: '+F.VERSION);
let d=F.makeSyntheticRom();d[0x20]=0x40;d[0x7FEA]=0x20;d[0x7FEB]=0x80;
const rom=F.loadRom(d,'irq.sfc'),a=F.analyze(rom),p=F.generateProject(rom,a);
const rt=String(p['src/runtime.hpp']),dispatch=String(p['src/dispatch.cpp']);
ok(rt.includes('enterInterrupt'),'frame de entrada de interrupcao ausente');
ok(rt.includes('returnInterrupt'),'restauracao de RTI ausente');
ok(rt.includes('cpu.enterInterrupt(*this,resumePc,false)')&&/hw\.serviceCpuEvents\(cpu,resumePc(,false)?\)/.test(dispatch),'NMI/IRQ nao empilha estado real');
ok(p['analysis.json'].includes('"interrupt_stack_frames": true'),'metadata interrupt_stack_frames ausente');
ok(p['analysis.json'].includes('"rti_state_restore": true'),'metadata rti_state_restore ausente');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v0310-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});
fs.writeFileSync(path.join(dir,'src','runtime.hpp'),rt);
fs.writeFileSync(path.join(dir,'test.cpp'),`#include "src/runtime.hpp"\n#include <cassert>\nint main(){SnesRuntime hw;CpuState c;c.e=false;c.m8=false;c.x8=false;c.pb=0x80;c.s=0x1ff0;c.c=true;c.z=true;c.i=false;c.decimalMode=true;c.v=true;c.n=true;auto p=c.packP();c.enterInterrupt(hw,0x80ABCDu,false);assert(c.s==0x1FECu);assert(c.pb==0);assert(c.i);assert(!c.decimalMode);assert(c.peekStack8(hw,1)==p);assert(c.peekStack8(hw,2)==0xCDu);assert(c.peekStack8(hw,3)==0xABu);assert(c.peekStack8(hw,4)==0x80u);c.returnInterrupt(hw);assert(c.s==0x1FF0u);assert(c.pb==0x80);assert(c.packP()==p);CpuState e;e.e=true;e.enforceEmulation();e.pb=0x77;e.s=0x1FF;e.i=false;e.enterInterrupt(hw,0x001234u,false);assert(e.s==0x1FCu);assert((e.peekStack8(hw,1)&0x10u)==0);assert(e.peekStack8(hw,2)==0x34u);assert(e.peekStack8(hw,3)==0x12u);e.returnInterrupt(hw);assert(e.s==0x1FFu);assert(e.pb==0);return 0;}\n`);
cp.execFileSync('g++',['-std=c++20','-O0',path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{stdio:'inherit'});
cp.execFileSync(path.join(dir,'test'),[],{stdio:'inherit'});
console.log('Interrupt stack v0.3.10 regression: PASS');
