const assert=require('assert');
const C=require('../forja65-core.js');
let d=C.makeSyntheticRom();
const h=0x7FC0;
// RESET continua normal em $8000. NMI-EMU aponta propositalmente para $FFE4,
// que e a propria janela reservada a vetores/header e nao deve virar codigo.
d[h+0x3A]=0xE4; d[h+0x3B]=0xFF; // $FFFA NMI emulation
let rom=C.loadRom(d,'vector-table-guard.sfc');
let a=C.analyze(rom,4096,[]);
assert(!a.entryPoints.some(e=>e.vector===0xFFFA),'NMI que aponta para $FFE4 foi aceito como codigo');
assert(!a.instructions.some(i=>(i.pc&0xFFFF)>=0xFFE0),'analisador decodificou a janela de vetores como codigo');
// Um RESET corrompido/enganoso na propria janela de vetores deve ser recusado e reportado.
d=C.makeSyntheticRom(); d[h+0x3C]=0xE4; d[h+0x3D]=0xFF;
rom=C.loadRom(d,'bad-reset-vector.sfc'); a=C.analyze(rom,4096,[]);
assert(a.issues.some(q=>q.kind==='VECTOR'),'RESET na tabela de vetores deveria gerar issue VECTOR');
assert(!a.instructions.some(i=>i.pc===0x00FFE4),'RESET $FFE4 nao pode ser decodificado como rotina');
console.log('Vector-table guard v0.3.30 regression: PASS');
