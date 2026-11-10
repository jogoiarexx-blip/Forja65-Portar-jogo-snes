const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
let d=F.makeSyntheticRom();
const h=0x7FC0;
// Native NMI -> $8020.
d[h+0x2A]=0x20; d[h+0x2B]=0x80;
// RESET: LDA #$80; STA $4200; WAI; LDA #$33; RTS
// WAI must resume at the following compiled instruction after NMI.
d.set([0xA9,0x80,0x8D,0x00,0x42,0xCB,0xA9,0x33,0x60],0x0000);
// NMI: INX; RTI
d.set([0xE8,0x40],0x0020);
const rom=F.loadRom(d,'v019.sfc');
const a=F.analyze(rom,2048);
ok(a.partial===0 && a.unsupported===0,'v0.1.9 test should be fully native');
ok(a.instructions.some(i=>i.mnemonic==='WAI'&&i.status==='native'),'WAI must be native');
ok(a.instructions.some(i=>i.pc===0x008006),'CFG must resume after WAI');
ok(a.entryPoints.some(e=>e.name.startsWith('NMI-NATIVE')&&e.target===0x8020),'NMI vector missing');
const pr=F.generateProject(rom,a);
ok(pr['assets/cart-data.bin'] instanceof Uint8Array,'cart data asset missing');
ok(pr['assets/cart-data.bin'].length===rom.data.length,'cart data length mismatch');
ok((pr['src/dispatch.cpp']||'').includes('forja65_wait'), 'compiled WAI helper missing');
ok((pr['src/dispatch.cpp']||'').includes('0x008020u')&&(pr['src/dispatch.cpp']||'').includes('forja65_dispatch'), 'NMI state-aware dispatch missing');
ok(pr['src/runtime.hpp'].includes('wramOffset'), 'WRAM bus missing');
ok(pr['src/runtime.hpp'].includes('romOffset'), 'ROM data bus missing');
console.log('Native loop/data bus v0.1.9 regression: PASS',{decoded:a.decoded,functions:a.cfgFunctions,native:a.native});
