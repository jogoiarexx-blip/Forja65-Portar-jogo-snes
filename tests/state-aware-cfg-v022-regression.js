const F=require('../forja65-core.js');
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
function ok(x,m){if(!x)throw new Error(m)}
// State merge: same PC $00800C is reached once with M=0 and once with M=1.
let d=F.makeSyntheticRom();
d.set([
  0x18,       // CLC
  0xFB,       // XCE -> native mode
  0xD0,0x05,  // BNE $8009
  0xC2,0x20,  // REP #$20 -> M=0
  0x80,0x04,  // BRA $800C
  0xEA,       // filler
  0xE2,0x20,  // $8009 SEP #$20 -> M=1
  0xEA,       // $800B
  0xA9,0x34,0x60,0x60 // $800C: LDA #$34 (M=1) OR LDA #$6034 (M=0), then RTS
],0);
let rom=F.loadRom(d,'state-aware.sfc'),a=F.analyze(rom,2048);
const vars=a.functions.flatMap(f=>f.instructions).filter(i=>i.pc===0x00800C);
ok(vars.length===2,'esperadas 2 variantes em $00800C, veio '+vars.length);
ok(new Set(vars.map(v=>v.size)).size===2,'variantes M=0/M=1 nao mudaram tamanho da instrucao');
ok(a.stateVariantAddressCount>=1,'contador de enderecos state-aware nao incrementou');const stateVariantCount=a.stateVariantAddressCount;
ok(!a.issues.some(i=>i.kind==='CFG-STATE'),'CFG-STATE antigo ainda apareceu');
let p=F.generateProject(rom,a),g=Object.entries(p).filter(([k])=>/^src\/generated_\d+\.cpp$/.test(k)).map(([,v])=>String(v)).join('\n');
ok(g.includes('variantes de decodificacao M/X'),'C++ nao emitiu guarda de variantes');
ok(g.includes('cpu.m8==true')&&g.includes('cpu.m8==false'),'C++ nao testa M8 nas duas variantes');
// Remaining SMW opcodes from v0.2.1.
d=F.makeSyntheticRom();d.set([0x99,0x34,0x12,0x0D,0x78,0x56,0x60],0);rom=F.loadRom(d,'last-opcodes.sfc');a=F.analyze(rom,128);
ok(a.unsupported===0,'STA abs,Y / ORA abs ainda nao ficaram nativos');
// End-to-end compile/link/run of the state-aware generated project.
rom=F.loadRom(require('./fixtures/bootable-rom')(),'e2e.sfc');a=F.analyze(rom,512);p=F.generateProject(rom,a);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v022-'));
for(const [name,val] of Object.entries(p)){const q=path.join(dir,name);fs.mkdirSync(path.dirname(q),{recursive:true});fs.writeFileSync(q,val instanceof Uint8Array?Buffer.from(val):val);}
cp.execFileSync('cmake',['-S',dir,'-B',path.join(dir,'build')],{stdio:'ignore'});
cp.execFileSync('cmake',['--build',path.join(dir,'build'),'-j','2'],{stdio:'ignore'});
const exe=path.join(dir,'build',process.platform==='win32'?'game.exe':'game');cp.execFileSync(exe,[],{cwd:path.join(dir,'build'),stdio:'ignore'});
console.log('State-aware CFG v0.2.2 regression: PASS',{variantsAt800C:vars.length,stateVariantAddresses:stateVariantCount});
