const assert=require('assert');
const C=require('../forja65-core.js');
const bytes=C.makeSyntheticRom();
// Native mode, 16-bit X, redefine a pilha e semeia dois retornos sinteticos.
bytes.set([0x18,0xFB,0xC2,0x30,0xA2,0xFF,0x01,0x9A,0xF4,0xFF,0x80,0xF4,0xFF,0x81,0xDB],0x0000);
bytes[0x0100]=0x60; // $00:8100
bytes[0x0200]=0x60; // $00:8200
const rom=C.loadRom(bytes,'pea-stack-bootstrap.sfc');
const a=C.analyze(rom,8192,[]);
const pcs=new Set(a.instructions.map(i=>i.pc&0xFFFFFF));
assert(pcs.has(0x008100),'PEA $80FF deveria semear RTS -> $008100');
assert(pcs.has(0x008200),'PEA $81FF deveria semear RTS -> $008200');
const issues=a.issues.filter(x=>x.kind==='CFG-RESOLVED-STACK-BOOTSTRAP');
assert(issues.length>=2,'esperava ao menos dois retornos sinteticos TXS+PEA');
console.log('OK PEA stack bootstrap',issues.map(x=>x.detail));
