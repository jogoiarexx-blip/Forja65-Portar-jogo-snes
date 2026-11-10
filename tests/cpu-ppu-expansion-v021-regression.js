const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const C=require('../forja65-core.js');
function assert(x,m){if(!x)throw new Error(m);}
const rom=C.loadRom(C.makeSyntheticRom(),'v021.sfc');
const cases=[
 [0x8B,'PHB','Implied'],[0x4B,'PHK','Implied'],[0xAB,'PLB','Implied'],[0x4A,'LSR','Accumulator'],
 [0xAC,'LDY','Absolute'],[0xCC,'CPY','Absolute'],[0xC9,'CMP','ImmA'],[0xC0,'CPY','ImmX'],[0x6D,'ADC','Absolute'],
 [0x2C,'BIT','Absolute'],[0xED,'SBC','Absolute'],[0xB9,'LDA','AbsoluteY'],[0x4D,'EOR','Absolute'],[0x2D,'AND','Absolute'],
 [0x1D,'ORA','AbsoluteX'],[0x26,'ROL','Direct'],[0x65,'ADC','Direct'],[0xBF,'LDA','AbsoluteLongX'],[0xEC,'CPX','Absolute'],
 [0x79,'ADC','AbsoluteY'],[0xBE,'LDX','AbsoluteY'],[0xBC,'LDY','AbsoluteX']
];
for(const [op,mn,mode] of cases){rom.data[0]=op;rom.data[1]=0;rom.data[2]=0;rom.data[3]=0;const i=C.decodeOne(rom,0x008000,{emulation:true,m8:true,x8:true,carry:null});assert(i.status==='native',`$${op.toString(16)} nao nativo`);assert(i.mnemonic===mn&&i.mode===mode,`$${op.toString(16)} decode ${i.mnemonic}/${i.mode}`);}
const base=C.loadRom(C.makeSyntheticRom(),'runtime.sfc'),a=C.analyze(base),files=C.generateProject(base,a);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v021-'));fs.mkdirSync(path.join(dir,'src'));
fs.writeFileSync(path.join(dir,'src','runtime.hpp'),files['src/runtime.hpp']);
fs.writeFileSync(path.join(dir,'runtime_test.cpp'),`#include "src/runtime.hpp"\n#include <cassert>\nint main(){SnesRuntime hw;CpuState cpu;\n cpu.pb=0x0C;cpu.db=0x01;cpu.push("PHB",hw);cpu.push("PHK",hw);cpu.pop("PLB",hw);assert(cpu.db==0x0C);cpu.pop("PLB",hw);assert(cpu.db==0x01);\n cpu.m8=true;cpu.a=0x81;cpu.c=false;cpu.lsrA();assert((cpu.a&0xFF)==0x40&&cpu.c);\n hw.ram[0x20]=0x80;cpu.c=true;cpu.rolMem(hw,0x20,8);assert(hw.ram[0x20]==0x01&&cpu.c);\n cpu.a=0x40;cpu.bit(0xC0,false);assert(!cpu.z&&cpu.n&&cpu.v);\n hw.write8(0x2123,0x12);hw.write8(0x2124,0x34);hw.write8(0x2125,0x56);assert(hw.ppu.w12sel==0x12&&hw.ppu.w34sel==0x34&&hw.ppu.wobjsel==0x56);\n hw.write8(0x211B,0x34);hw.write8(0x211B,0x12);assert(hw.ppu.m7[0]==0x1234);\n hw.write8(0x2132,0x9F);assert(hw.ppu.fixedB==31);\n hw.write8(0x4209,0x34);hw.write8(0x420A,1);assert(hw.io.vtime==0x134);\n return 0;}\n`);
try{cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'runtime_test.cpp'),'-o',path.join(dir,'runtime_test')],{stdio:'inherit'});cp.execFileSync(path.join(dir,'runtime_test'),[],{stdio:'inherit'});}catch(e){throw new Error('falha compilando/executando runtime C++ v0.2.1: '+e.message)}
const generated=Object.entries(files).filter(([k])=>k==='src/dispatch.cpp'||/^src\/generated_\d+\.cpp$/.test(k)).map(([,v])=>String(v)).join('\n');assert(generated.includes('cpu.pb=(std::uint8_t)(requested>>16)'),'program bank runtime dispatch sync missing');assert(!/cpu\.pb=0x[0-9A-Fa-f]+u; \/\/ sincroniza Program Bank/.test(generated),'labels nao devem sobrescrever PB de aliases da ROM');
console.log('CPU/PPU expansion v0.2.1 regression: PASS',{opcodes:cases.length});
