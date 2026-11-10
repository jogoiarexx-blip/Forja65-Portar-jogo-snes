// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
ok(/^0\.(?:2\.|3\.|4\.)/.test(F.VERSION),'familia v0.2+/v0.3.x ausente');
// ROM LoROM irregular de 0x120000 bytes: o espelhamento deve seguir Snes9x/bsnes.
const oddData=new Uint8Array(0x120000), oddRom={data:oddData,header:{mapping:F.MAP.LOROM}};
ok(F.snesToRom(oddRom,0x248000)===0x100000,'mirror LoROM irregular 0x120000 incorreto');
ok(F.snesToRom(oddRom,0x258000)===0x108000,'mirror LoROM irregular banco seguinte incorreto');
const visible=[0x54,0x7C,0xB1,0xA6,0x2B,0x25,0xC6,0x0B,0xFC,0x7B,0xA7,0x05,0xDD,0xE5,0xD7,0x66,0x06,0xF4,0xA3,0x83,0x95,0xE4,0x6A,0xCF,0x01,0x04,0x81,0xDE,0x3B];
const rom=F.loadRom(F.makeSyntheticRom(),'v028.sfc');
let catalogNative=0;for(let op=0;op<256;op++){rom.data[0]=op;rom.data[1]=0;rom.data[2]=0x80;rom.data[3]=0;const i=F.decodeOne(rom,0x008000,{emulation:false,m8:true,x8:true,carry:null});if(i.status==='native')catalogNative++;}
ok(catalogNative===256,'catalogo 65C816 nao ficou 256/256 native');
for(const op of visible){rom.data[0]=op;rom.data[1]=0x10;rom.data[2]=0x80;rom.data[3]=0x00;const st={emulation:false,m8:true,x8:true,carry:null};const i=F.decodeOne(rom,0x008000,st);ok(i.status==='native',`opcode $${op.toString(16)} ainda nao nativo (${i.mnemonic}/${i.mode})`);}
for(const op of [0xEE,0xCE]){rom.data[0]=op;rom.data[1]=0x00;rom.data[2]=0x20;const i=F.decodeOne(rom,0x008000,{emulation:false,m8:true,x8:true,carry:null});ok(i.status==='native',`INC/DEC absoluto ainda parcial $${op.toString(16)}`);}
const base=F.loadRom(require('./fixtures/bootable-rom')(),'build.sfc'),a=F.analyze(base,1024),p=F.generateProject(base,a);const h=p['src/runtime.hpp'];
for(const q of ['addressDpIndirectX','addressStackIndirectY','decMem','aslMem','rorMem','blockMove','push16Value','0x2134','0x213F','wrio'])ok(h.includes(q),'runtime sem '+q);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v028-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});fs.writeFileSync(path.join(dir,'src','runtime.hpp'),h);
fs.writeFileSync(path.join(dir,'test.cpp'),`#include "src/runtime.hpp"\n#include <cassert>\nint main(){SnesRuntime hw;CpuState c;c.e=false;c.m8=true;c.x8=true;c.d=0x0200;c.db=0x7E;c.s=0x01F0;hw.write(0x0201,0x34,8);hw.write(0x0202,0x12,8);c.x=1;assert((c.addressDpIndirectX(hw,0)&0xFFFF)==0x1234);c.a=0x81;c.c=false;c.rorA();assert((c.a&0xFF)==0x40&&c.c);hw.write(0x7E1000,0x80,8);c.aslMem(hw,0x7E1000,8);assert(hw.read(0x7E1000)==0&&c.c&&c.z);c.a=0x0F;hw.write(0x7E1001,0xF0,8);c.tsb(hw,0x7E1001,8);assert(hw.read(0x7E1001)==0xFF&&c.z);c.a=0x0F;c.trb(hw,0x7E1001,8);assert(hw.read(0x7E1001)==0xF0&&!c.z);hw.write8(0x004201,0x7F);assert(hw.read(0x004213)==0x7F);hw.ppu.m7[0]=2;hw.ppu.m7[1]=3u<<8;assert(hw.ppu.read(0x2134)==6);hw.cart.assign(0x120000,0);hw.mapper=MapperKind::LoROM;assert(hw.romOffset(0x248000)==0x100000);assert(hw.romOffset(0x258000)==0x108000);return 0;}\n`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{stdio:'inherit'});cp.execFileSync(path.join(dir,'test'),[],{stdio:'inherit'});
for(const [name,val] of Object.entries(p)){const q=path.join(dir,'full',name);fs.mkdirSync(path.dirname(q),{recursive:true});fs.writeFileSync(q,val instanceof Uint8Array?Buffer.from(val):val);}cp.execFileSync('cmake',['-S',path.join(dir,'full'),'-B',path.join(dir,'full','build')],{stdio:'ignore'});cp.execFileSync('cmake',['--build',path.join(dir,'full','build'),'-j','2'],{stdio:'ignore'});const exe=path.join(dir,'full','build',process.platform==='win32'?'game.exe':'game');cp.execFileSync(exe,[],{cwd:path.join(dir,'full','build'),stdio:'ignore'});
console.log('Cross-game CPU/flow v0.2.8 regression: PASS',{opcodes:visible.length,catalogNative});
