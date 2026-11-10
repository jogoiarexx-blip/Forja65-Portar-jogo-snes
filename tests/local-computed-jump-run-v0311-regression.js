// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
let d=F.makeSyntheticRom();d.fill(0xEA,0,0x300);
// Native M16; A contem um pequeno offset desconhecido estaticamente. Base+offset vai para JMP(dp).
d.set([0x18,0xFB,0xC2,0x20,0x18,0x69,0x30,0x80,0x85,0x1E,0x6C,0x1E,0x00],0);
// $8030..$8037: ilha de entradas legais de um byte; qualquer byte pode ser o destino computado.
d.fill(0x4A,0x30,0x38); d[0x38]=0x60;
const rom=F.loadRom(d,'local-computed.sfc'),a=F.analyze(rom,2048);
ok(/^0\.(?:3|4)\.\d+/.test(F.VERSION),'familia v0.3.x esperada: '+F.VERSION);
for(const t of [0x8030,0x8032,0x8037])ok(a.functions.some(f=>f.start===t)||a.functions.some(f=>f.instructions.some(i=>i.pc===t)),'faltou computed target '+t.toString(16));
ok(a.issues.some(x=>x.kind==='CFG-RESOLVED-INDIRECT'&&x.pc===0x800A),'JMP(dp) local nao foi marcado como resolvido');
console.log('Local computed jump-run v0.3.11 regression: PASS');
