// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
let d=F.makeSyntheticRom();d.fill(0xEA,0,0x400);
// RESET: entra em native mode, chama uma rotina que usa PEI+RTS como computed-goto.
d.set([0x18,0xFB,0x22,0x00,0x81,0x00,0xA9,0x34,0x12,0xDB],0x0000);
// $8100: cria $81FF na stack via PEI; RTS salta para $8200 sem consumir o frame do JSL.
d.set([0xC2,0x20,0xA9,0xFF,0x81,0x85,0x32,0xE2,0x20,0xA9,0xFF,0x85,0x32,0xD4,0x32,0x60],0x0100);
// $8200: destino efetivo; muda M para 16 bits e RTL retorna ao caller original.
d.set([0xC2,0x20,0x6B],0x0200);
const rom=F.loadRom(d,'trampoline-summary.sfc'),a=F.analyze(rom,12000,[],{summaryRounds:8});
ok(/^0\.(?:3|4)\.\d+/.test(F.VERSION),'familia v0.3.x esperada: '+F.VERSION);
ok(a.syntheticReturnTargets.includes(0x008200),'trampoline PEI+RTS para $008200 nao descoberto');
const ret=a.functions.flatMap(f=>f.instructions).filter(i=>i.pc===0x008006);
ok(ret.some(i=>i.stateIn&&!i.stateIn.emulation&&!i.stateIn.m8),'return-site $008006 nao recebeu M=16 do RTL efetivo');
const lda16=ret.find(i=>i.stateIn&&!i.stateIn.emulation&&!i.stateIn.m8);
ok(lda16&&lda16.mnemonic==='LDA'&&lda16.size===3&&lda16.operand===0x1234,'return-site nao foi decodificado como LDA #imm16');
console.log('Stack trampoline call-summary v0.3.10 regression: PASS',{variants:ret.map(i=>i.stateSig),rounds:a.summaryRounds});
