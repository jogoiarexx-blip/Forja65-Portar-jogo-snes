// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
let d=F.makeSyntheticRom();d.fill(0xEA,0,0x500);
// native M16; simula CMP/EOR/ASL/TAX + JMP (inline-table,X).
d.set([0x18,0xFB,0xC2,0x20,0xC9,0xEF,0x00,0x90,0x02,0x49,0xFF,0x00,0x0A,0xAA,0x7C,0x12,0x80],0);
// $8012: 17 ponteiros para $8100 + n*4.
for(let n=0;n<17;n++){const t=0x8100+n*4,o=0x12+n*2;d[o]=t&255;d[o+1]=t>>8;d[0x100+n*4]=0x60;}
const rom=F.loadRom(d,'inline-table.sfc'),a=F.analyze(rom,4096);
ok(/^0\.(?:3|4)\.\d+/.test(F.VERSION),'familia v0.3.x esperada: '+F.VERSION);
for(const t of [0x8100,0x8120,0x8140])ok(a.functions.some(f=>f.start===t),'faltou alvo inline '+t.toString(16));
ok(a.issues.some(x=>x.kind==='CFG-RESOLVED-INDIRECT'&&x.pc===0x800E),'JMP(table,X) nao resolvido');
console.log('Inline indexed jump-table v0.3.12 regression: PASS');
