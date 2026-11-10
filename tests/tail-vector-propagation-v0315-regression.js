// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
ok(/^(?:0\.3\.|0\.4\.)/.test(F.VERSION),'versao inesperada '+F.VERSION);
const d=new Uint8Array(0x10000);d.fill(0xEA);const h=0x7FC0;const title='TAIL VECTOR TEST';for(let i=0;i<title.length;i++)d[h+i]=title.charCodeAt(i);
d[h+0x15]=0x20;d[h+0x16]=0;d[h+0x17]=6;d[h+0x18]=0;for(let o=0x20;o<0x40;o++)d[h+o]=0;d[h+0x3C]=0;d[h+0x3D]=0x80;
// reset: entra em modo nativo 16-bit e faz JMP [$004E]
d.set([0x18,0xFB,0xC2,0x30,0xDC,0x4E,0x00],0x0000);
// caller nao alcançado diretamente: A=#8200, X=#0081, JML $808300
d.set([0xA9,0x00,0x82,0xA2,0x81,0x00,0x5C,0x00,0x83,0x80],0x0100);
// trampoline: JMP $8400
d.set([0x4C,0x00,0x84],0x0300);
// setter: STA $4E ; STX $50 ; RTS
d.set([0x85,0x4E,0x86,0x50,0x60],0x0400);
// inferred target $81:8200 => LoROM file $8200
d[0x8200]=0x60;
const rom=F.loadRom(d,'tail-vector.sfc'),a=F.analyze(rom,2048);
ok(a.instructions.some(i=>i.pc===0x818200),'alvo $818200 nao foi propagado pelo tail trampoline');
ok(a.issues.some(x=>x.pc===0x008004&&x.kind==='CFG-RESOLVED-INDIRECT'),'JMP [ptr] nao foi marcado como resolvido');
const p=F.generateProject(rom,a);ok(p['analysis.json'].includes('"tail_vector_register_propagation": true'),'metadata ausente');
console.log('Tail vector propagation v0.3.15 regression: PASS',{decoded:a.decoded});
