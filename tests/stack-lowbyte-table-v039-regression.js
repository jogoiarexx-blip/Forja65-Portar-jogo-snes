const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
let d=F.makeSyntheticRom();d.fill(0xEA,0,0x300);
// reset: JSR $8100; STP
 d.set([0x20,0x00,0x81,0xDB],0);
// 16-way PEI+RTS computed low-byte trampoline.
 d.set([0xA5,0x10,0x29,0x0F,0x0A,0x0A,0x69,0x3F,0x85,0x32,0xD4,0x32,0x60],0x100);
for(let n=0;n<16;n++){const o=0x40+n*4;d.set([0x4C,0x00,0x82,0xEA],o);}d[0x200]=0xDB;
const rom=F.loadRom(d,'lowtable.sfc'),a=F.analyze(rom,12000);
for(const t of [0x8040,0x8044,0x8060,0x807C])ok(a.syntheticReturnTargets.includes(t),'faltou target '+t.toString(16));
ok(a.issues.some(x=>x.kind==='CFG-RESOLVED-STACK'&&String(x.detail).includes('8060')),'nao registrou stack table resolvida');
console.log('Stack low-byte table v0.3.10 regression: PASS',{targets:a.syntheticReturnTargets.length,decoded:a.decoded});
