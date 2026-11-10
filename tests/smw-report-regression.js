const C=require('../forja65-core.js');
function romWith(code){const d=C.makeSyntheticRom();d.set(code,0);return C.loadRom(d,'smw-reset-regression.sfc');}
// Pattern based on the user's first real diagnostic: native instruction followed by STZ absolute.
let a=C.analyze(romWith([0x78,0x9C,0x00,0x42,0x18,0x60]),32);
if(a.instructions[0].mnemonic!=='SEI') throw new Error('SEI');
if(a.instructions[1].mnemonic!=='STZ'||a.instructions[1].size!==3||a.instructions[1].status!=='native') throw new Error('STZ $9C');
if(a.instructions[2].pc!==0x8004||a.instructions[2].mnemonic!=='CLC') throw new Error('alignment after STZ');
if(!a.issues.some(x=>x.kind==='HW-NATIVE'&&x.pc===0x8001)) throw new Error('native hardware bridge for $4200');
// An unsupported semantic must use the catalogued opcode length and continue instead of stopping/desyncing.
a=C.analyze(romWith([0x01,0x44,0x18,0x60]),32); // ORA ($44,X), CLC, RTS
if(a.decoded!==3||a.instructions[1].pc!==0x8002||a.instructions[1].mnemonic!=='CLC') throw new Error('unsupported continuation');
console.log('PASS SMW diagnostic regression');
