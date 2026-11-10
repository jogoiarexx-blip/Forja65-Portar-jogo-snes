'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core');
function fixture(opcode=0x5c,target=0x208000,reset=0xffe0){
 const data=Buffer.alloc(0x120000,0xff);
 const h=0x7fc0;
 data.write('TEST VECTOR JML',h,'ascii');
 data[h+0x15]=0x20;data[h+0x16]=0;data[h+0x17]=10;data[h+0x18]=0;
 data.writeUInt16LE(0xEDCB,h+0x1c);data.writeUInt16LE(0x1234,h+0x1e);
 data.writeUInt16LE(reset,h+0x3c);
 data[0x7fe0]=opcode;
 data[0x7fe1]=target&255;data[0x7fe2]=(target>>8)&255;data[0x7fe3]=(target>>16)&255;
 // `SEI; STP` at the genuine LoROM bank 20 target.
 data[0x100000]=0x78;data[0x100001]=0xdb;
 return C.loadRom(data);
}
function analyze(rom){return C.analyze(rom,256);}
const valid=analyze(fixture());
assert(valid.entryPoints.some(e=>e.name==='RESET'&&e.target===0xffe0), 'must admit exact RESET vector stub');
const stub=valid.functions.find(f=>f.entryName==='RESET');
assert(stub&&stub.instructions.some(i=>i.pc===0xffe0&&i.mnemonic==='JML'), 'must decode the ROM JML at reset');
assert(stub.instructions.some(i=>i.pc===0x208000&&i.mnemonic==='SEI'), 'must follow JML into the real bank');
for(const rom of [fixture(0xea),fixture(0x5c,0x20ffe0),fixture(0x5c,0x200000),fixture(0x5c,0x208000,0xffe4)]){
 // The final case moves reset to $FFE4, pointing to vector contents rather than the real JML.
 const a=analyze(rom);
 assert(!a.entryPoints.some(e=>e.name==='RESET'), 'must reject non-proven vector-table instructions');
}
console.log('RESET_VECTOR_JML_TRAMPOLINE_V0428_PASS 5 cases');
