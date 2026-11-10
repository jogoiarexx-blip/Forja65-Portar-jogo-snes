const assert=require('assert');
const C=require('../forja65-core.js');
const d=C.makeSyntheticRom();
// Reset: native 16-bit; estado em DP $20 -> X*2 -> JMP por tabela em $8020.
d.set([0x18,0xFB,0xC2,0x30,0xA5,0x20,0x0A,0xAA,0x7C,0x20,0x80],0x0000);
// Evidencia conservadora de faixa da variavel: 0,1,3,4.
d.set([0x64,0x20,0xA9,0x01,0x00,0x85,0x20,0xA9,0x03,0x00,0x85,0x20,0xA9,0x04,0x00,0x85,0x20,0x60],0x0040);
// 5 handlers $8100..$8500.
const targets=[0x8100,0x8200,0x8300,0x8400,0x8500];
for(let k=0;k<targets.length;k++){const o=0x20+k*2;d[o]=targets[k]&255;d[o+1]=targets[k]>>8;d[targets[k]-0x8000]=0x60;}
const rom=C.loadRom(d,'dp-indexed-table.sfc');
const a=C.analyze(rom,8192,[]);const pcs=new Set(a.instructions.map(i=>i.pc&0xFFFFFF));
for(const t of targets)assert(pcs.has(t),'handler $'+t.toString(16)+' nao descoberto');
const issue=a.issues.find(x=>x.pc===0x008008&&x.kind==='CFG-RESOLVED-INDIRECT');
assert(issue&&/5 alvo/.test(issue.detail),'tabela deveria ter 5 alvos resolvidos');
console.log('OK DP indexed table range',issue.detail);
