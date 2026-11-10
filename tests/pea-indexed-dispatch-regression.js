const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('assert'),C=require('../forja65-core');
const data=C.makeSyntheticRom();data.fill(0xdb,0,0x100);
data.set([0x20,0x20,0x80,0xdb],0);
// RAM-selected index, synthetic RTS continuation, two inline vectors.
data.set([0xa6,0x10,0xf4,0x27,0x80,0x7c,0x29,0x80,0x60,0x2d,0x80,0x30,0x80,0xa9,7,0x60,0xa9,9,0x60],0x20);
const rom=C.loadRom(data),a=C.analyze(rom,1024);
for(const pc of [0x8028,0x802d,0x8030])assert(a.instructions.some(i=>i.pc===pc),'missing inline dispatch target '+pc.toString(16));
const broken=Uint8Array.from(data);broken[0x23]=0x26;const negative=C.analyze(C.loadRom(broken),1024);
assert(!negative.instructions.some(i=>i.pc===0x8030),'unproven PEA return must not infer inline vectors');
const files=C.generateProject(rom,a),dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-pea-dispatch-'));
for(const [n,v]of Object.entries(files)){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
fs.writeFileSync(path.join(dir,'probe.cpp'),`#include "src/generated.hpp"\n#include <cassert>\nint main(){for(unsigned x:{0u,2u}){SnesRuntime h("assets/cart-data.bin",MapperKind::LoROM);CpuState c;h.ram[0x10]=x;forja65_dispatch(c,h,0x8000,0xffffff);assert(c.a==(x?9:7)&&c.s==0x1ff&&h.nativeReturns.empty()&&h.stopped);}}\n`);
const units=Object.keys(files).filter(n=>/^src\/(dispatch|generated_\d+|native_hooks)\.cpp$/.test(n));
cp.execFileSync('g++',['-std=c++20','-O1','probe.cpp',...units,'-o','probe'],{cwd:dir});cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,env:{...process.env,FORJA65_HEADLESS:'1'}});
console.log('pea-indexed-dispatch-regression: OK (both RAM indices, synthetic return, invalid anchor rejected)');
// HiROM: JMP at FFFD wraps its return to 0000 in the same program bank.
const high=C.loadRom(C.makeSyntheticRom());high.header.mapping='HiROM';high.data=new Uint8Array(0x20000);high.data.fill(0xdb);
high.data.set([0x60,5,0,8,0,0xa9,7,0x60,0xa9,9,0x60],0);
high.data.set([0x4c,0xfa,0xff],0xffdd);high.data.set([0xf4,0xff,0xff,0x7c,1,0],0xfffa);high.data[0x10000]=0x60;
const ha=C.analyze(high,1024,'target=c0ffdd kind=FLOW e=1 m=1 x=1 c=?');
assert(ha.instructions.some(i=>i.pc===0xc00000),'wrapped PEA return must preserve C0 bank');
assert(!ha.functions.some(f=>f.entryName==='PEA-JUMP-RETURN'&&f.start===0xc10000),'return must not increment PB');
console.log('pea-indexed-dispatch-regression: OK (HiROM bank wrap)');
