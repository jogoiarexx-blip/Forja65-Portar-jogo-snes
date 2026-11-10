'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const C=require('../forja65-core');
const rom=C.makeSyntheticRom();
// The regular reset routine calls the trampoline, making it reachable in CFG.
rom.set([0x22,0x00,0x82,0x00,0x20,0x00,0x81,0xDB],0x0000);
rom.set([0x6B],0x0200);
rom.set([0x4B,0xF4,0x07,0x81,0xDC,0x64,0x18,0xEA,0x60],0x0100);
const r=C.loadRom(rom,'stack-trampoline.sfc');
const analysis=C.analyze(r,2500),files=C.generateProject(r,analysis);
const generated=Object.entries(files).filter(([name])=>/src\/generated_.*\.cpp/.test(name)).map(([,src])=>src).join('\n');
assert(generated.includes('hw.armConstructedLongReturn(0x008104u,cpu);'),'missing guarded trampoline registration');
assert(generated.includes('hw.armConstructedLongReturn(0x008104u,cpu); hw.requestDispatch(hw.observeLongIndirectJmp(0x008104u,0x1864u,cpu),0x008104u); return;'), 'audited JMP [abs] must preserve constructed RTL guard');
assert(generated.includes('hw.consumeConstructedLongReturn(dst,cpu)'),'missing RTL guard');
assert(files['src/runtime.hpp'].includes('bool armConstructedLongReturn('));
assert(files['src/dispatch.cpp'].includes('hw.armConstructedLongReturn(requested,cpu)'), 'fallback JMP missing guarded registration');
assert(files['src/dispatch.cpp'].includes('hw.observeLongIndirectJmp(requested,pointer,cpu)'), 'fallback JMP missing 24-bit live pointer observation');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-constructed-rtl-'));
try{
  for(const name of ['runtime.hpp','forja_trace.hpp','forja_ir.hpp'])fs.writeFileSync(path.join(dir,name),files['src/'+name]);
  cp.execFileSync('g++',['-std=c++20','-O0','-I',dir,path.join(__dirname,'constructed_long_return_v043690.cpp'),'-o',path.join(dir,'test')],{stdio:'inherit'});
  cp.execFileSync(path.join(dir,'test'),[],{stdio:'inherit'});
}finally{fs.rmSync(dir,{force:true,recursive:true});}
console.log('CONSTRUCTED_LONG_RETURN_V043690_PASS');
