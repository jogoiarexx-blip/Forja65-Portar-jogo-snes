const F=require('../forja65-core.js');
function fail(m){throw new Error(m)}
const expected={0x5B:'TCD',0x1B:'TCS',0x9F:'STA',0xE6:'INC',0xCD:'CMP',0xB7:'LDA',0xEB:'XBA',0xE0:'CPX',0x2A:'ROL',0x48:'PHA',0x68:'PLA',0x08:'PHP',0x28:'PLP',0x60:'RTS'};
const d=F.makeSyntheticRom();
const code=[0x5B,0x1B,0x9F,0x00,0x80,0x7E,0xE6,0x10,0xCD,0x00,0x20,0xB7,0x20,0xEB,0xE0,0x05,0x2A,0x48,0x68,0x08,0x28,0x60];
d.set(code,0);
const rom=F.loadRom(d,'smw-opcodes-regression.sfc');
const a=F.analyze(rom,256);
for(const i of a.instructions){if(expected[i.opcode] && i.status!=='native')fail(`opcode ${i.opcode.toString(16)} deveria ser native, veio ${i.status}`)}
if(a.unsupported!==0)fail(`esperado unsupported=0, veio ${a.unsupported}`);
if(a.partial!==0)fail(`esperado partial=0 na fixture, veio ${a.partial}`);
if(a.nativeRatio!==100)fail(`esperado nativeRatio=100, veio ${a.nativeRatio}`);
console.log('SMW opcode-set v0.1.3 regression: PASS');
