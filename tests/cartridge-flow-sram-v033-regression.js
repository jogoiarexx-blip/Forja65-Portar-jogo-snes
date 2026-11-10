const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
function hiRomDsp1(){
  const d=new Uint8Array(0x10000);d.fill(0xEA);const h=0xFFC0,t='V033 DSP1 TEST';for(let i=0;i<21;i++)d[h+i]=i<t.length?t.charCodeAt(i):32;
  d[h+0x15]=0x31;d[h+0x16]=0x05;d[h+0x17]=9;d[h+0x18]=1;d[h+0x19]=1;d[h+0x1A]=1;d[h+0x1C]=0xCB;d[h+0x1D]=0xED;d[h+0x1E]=0x34;d[h+0x1F]=0x12;
  for(let o=0x20;o<0x40;o++)d[h+o]=0;d[h+0x3C]=0x00;d[h+0x3D]=0x80;d[0x8000]=0x60;return d;
}
function ramVectorFixture(){
  const d=F.makeSyntheticRom();d.fill(0xEA,0,0x7FC0);const h=0x7FC0;for(let o=0x20;o<0x40;o++)d[h+o]=0;d[h+0x3C]=0;d[h+0x3D]=0x80;
  d.set([0x18,0xFB,0xC2,0x20,0x6C,0x4A,0x00],0x0000); // CLC ; XCE ; REP #$20 ; JMP ($004A)
  d.set([0xA9,0x00,0x90,0x85,0x4A],0x0100); // dataflow writer -> $009000
  d.set([0xEA,0x60],0x1000);return d;
}
const dsp=F.loadRom(hiRomDsp1(),'dsp1.sfc');ok(dsp.header.mapping==='HiROM','HiROM nao detectado');ok(dsp.header.coprocessor==='DSP1','DSP1 nao detectado');ok(dsp.header.sramBytes===2048,'SRAM 2 KiB nao detectada');ok(dsp.header.hasBattery,'battery nao detectada');
const da=F.analyze(dsp,1024);// REV137: o DSP-1 passou a ter HLE no runtime (src/forja_dsp1.hpp); deixou de ser bloqueio. Outros chips continuam bloqueando.
ok(!da.issues.some(x=>x.kind==='CART-COPROCESSOR'),'DSP-1 nao deveria mais bloquear o relatorio');
const rv=F.loadRom(ramVectorFixture(),'ram-vector.sfc'),ra=F.analyze(rv,2048);ok(ra.issues.some(x=>x.kind==='CFG-RESOLVED-INDIRECT'),'vetor RAM nao resolvido');ok(ra.functions.some(x=>x.start===0x009000),'alvo $009000 nao virou rotina');
const p=F.generateProject(dsp,da),hpp=p['src/runtime.hpp'];for(const q of ['sramOffset','saveSram','save.srm','CartChip::DSP1','unresolvedCartChipRead','forja65_dsp1_read('])ok(hpp.includes(q),'runtime sem '+q);ok(p['src/forja_dsp1.hpp'],'projeto DSP-1 sem src/forja_dsp1.hpp');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v033-cart-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});fs.writeFileSync(path.join(dir,'src','runtime.hpp'),hpp);fs.writeFileSync(path.join(dir,'src','forja_dsp1.hpp'),p['src/forja_dsp1.hpp']);fs.writeFileSync(path.join(dir,'cart.bin'),Buffer.alloc(0x10000,0xEA));
fs.writeFileSync(path.join(dir,'test.cpp'),`#include "src/runtime.hpp"\n#include <cassert>\nint main(){\n {SnesRuntime a("cart.bin",MapperKind::LoROM,2048,9,1,CartChip::None,"lo.srm");a.write8(0x700123u,0x5Au);assert(a.read(0xF00123u)==0x5Au);a.saveSram();}\n {SnesRuntime a("cart.bin",MapperKind::LoROM,2048,9,1,CartChip::None,"lo.srm");assert(a.read(0x700123u)==0x5Au);}\n {SnesRuntime h("cart.bin",MapperKind::HiROM,2048,9,1,CartChip::DSP1,"hi.srm");h.write8(0x206123u,0x66u);assert(h.read(0xA06123u)==0x66u);assert(h.cartChipAddress(0x806000u));assert(h.read(0x807000u)==0x80u);}\n return 0;}\n`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{cwd:dir,stdio:'inherit'});cp.execFileSync(path.join(dir,'test'),[],{cwd:dir,stdio:'inherit'});
console.log('CARTRIDGE_FLOW_SRAM_V033_PASS',{coprocessor:dsp.header.coprocessor,sram:dsp.header.sramBytes,ramVector:ra.functions.length});
