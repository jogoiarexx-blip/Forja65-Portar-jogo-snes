const F=require('../forja65-core.js');
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
function ok(x,m){if(!x)throw new Error(m)}
const insAt=(a,pc)=>a.functions.flatMap(f=>f.instructions).filter(i=>i.pc===pc);

// A) callee muda M (REP #$20) antes do RTS: o return-site precisa ser decodificado com M=0 (LDA #imm de 16 bits).
let d=F.makeSyntheticRom();
d.set([
  0x18,0xFB,          // $8000 CLC; XCE  -> nativo
  0xE2,0x30,          // $8002 SEP #$30  -> M=1 X=1
  0x20,0x0F,0x80,     // $8004 JSR $800F
  0xA9,0x34,0x12,     // $8007 LDA #$1234 (M=0 depois do retorno)
  0xCB,               // $800A WAI
  0x80,0xFD,          // $800B BRA $800A
  0xEA,0xEA,          // padding
  0xC2,0x20,          // $800F REP #$20
  0x60                // $8011 RTS
],0);
let rom=F.loadRom(d,'summary.sfc'),a=F.analyze(rom,2048);
const lda=insAt(a,0x8007);
ok(lda.length===1,'esperada 1 variante em $8007, veio '+lda.length);
ok(lda[0].size===3&&lda[0].stateIn.m8===false,'return-site usou M do chamador (size='+lda[0].size+', m8='+lda[0].stateIn.m8+')');
ok(insAt(a,0x8009).length===0,'$8009 (meio do operando) foi decodificado como instrucao');
ok(a.summaryRounds>=1,'ponto fixo interprocedural nao rodou');
let p=F.generateProject(rom,a),g=Object.entries(p).filter(([k])=>/^src\/generated_\d+\.cpp$/.test(k)).map(([,v])=>String(v)).join('\n');
ok(g.includes('callee devolveu M/X/E diferente'),'guarda de estado no return-site ausente');
ok(/cpu\.c==/.test(g),'v0.3.21 deve preservar Carry conhecido nos predicados C++ quando relevante');

// B) ADC invalida Carry conhecido: sem valor de A provado, XCE deve preservar ambos os modos possiveis.
d=F.makeSyntheticRom();
d.set([0x18,0xFB,0x38,0x69,0x00,0xFB,0xEA,0x60],0);
rom=F.loadRom(d,'stale-carry.sfc');a=F.analyze(rom,512);
const nop=insAt(a,0x8006);
ok(nop.some(i=>i.stateIn.emulation===false)&&nop.some(i=>i.stateIn.emulation===true),'Carry desconhecido apos ADC deve bifurcar XCE sem fixar modo de emulacao');

// C) hints: STATE/FLOW sao aceitos e Carry conhecido passa a identificar a entrada da funcao.
const hs=F.parseRuntimeHints('target=00825E from=008257 kind=STACK-RTS e=0 m=0 x=0 c=1\ntarget=008300 from=008300 kind=STATE e=0 m=1 x=1 c=0');
ok(hs.length===2&&hs[1].kind==='STATE','hint STATE nao parseado');
ok(hs[0].state.carry===true&&hs[1].state.carry===false,'Carry dos runtime hints nao foi preservado');

// D) compila e executa o projeto de A.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v036-'));
for(const [name,val] of Object.entries(p)){const q=path.join(dir,name);fs.mkdirSync(path.dirname(q),{recursive:true});fs.writeFileSync(q,val instanceof Uint8Array?Buffer.from(val):val);}
cp.execFileSync('cmake',['-S',dir,'-B',path.join(dir,'build')],{stdio:'ignore'});
cp.execFileSync('cmake',['--build',path.join(dir,'build'),'-j','2'],{stdio:'ignore'});
const exe=path.join(dir,'build',process.platform==='win32'?'game.exe':'game');
cp.execFileSync(exe,[],{cwd:path.join(dir,'build'),stdio:'ignore',env:{...process.env,FORJA65_HEADLESS_FRAMES:'2'},timeout:60000});
console.log('State summary v0.3.6 regression: PASS',{rounds:a.summaryRounds});
