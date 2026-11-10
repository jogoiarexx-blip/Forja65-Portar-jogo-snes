#!/usr/bin/env node
'use strict';
// REV135: ciclo completo "port executa -> interpretador registra -> Forja aprende -> geracao nativa".
// ROM sintetica: o reset le um ponteiro de uma tabela na ROM e faz JMP ($0010); a analise estatica
// nao conhece o destino ($9000). O port roda, o interpretador registra a entrada, a ferramenta
// learn-from-interpreter.js integra a rotina no port, e o novo binario roda o mesmo trecho em codigo
// nativo, com WRAM identica quadro a quadro.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..'),F=require(path.join(root,'forja65-core.js')),L=require(path.join(root,'tools','learn-from-interpreter.js'));

function romBytes(){
  const d=F.makeSyntheticRom();
  d.fill(0xEA,0,0x7FC0);
  // 8000: CLC XCE REP #$30 LDA #$8FFF INC A STA $10 JMP ($0010)  -> destino $9000 calculado em tempo de execucao
  d.set([0x18,0xFB,0xC2,0x30,0xA9,0xFF,0x8F,0x1A,0x85,0x10,0x6C,0x10,0x00],0);
  // 9000: LDA #$1234 STA $20 INC $22 JMP $8004 (volta ao codigo nativo, que salta de novo para $9000)
  d.set([0xA9,0x34,0x12,0x85,0x20,0xE6,0x22,0x4C,0x04,0x80],0x1000);
  return d;
}
const bytes=romBytes(),rom=F.loadRom(bytes,'learn-test.sfc'),hash=F.romFingerprint(rom);

// 1) unidades: leitura do log, validacao e classificacao
const rows=L.parseLog('# cabecalho\n009000 M0X0 from=00800A count=1\n7E2000 M0X0 from=00800A count=3\n009000 E1M0X1 from=00800A count=1\n00A000 E1 from=008000 count=2\n');
assert.strictEqual(rows.length,4);assert.deepStrictEqual([rows[3].e,rows[3].m,rows[3].x],[1,1,1]);rows.pop();
assert.strictEqual(L.validate(rom,rows[0]),null);
assert.strictEqual(L.validate(rom,rows[1]),'codigo-em-wram');
assert.strictEqual(L.validate(rom,rows[2]),'estado-impossivel-E1');
assert.strictEqual(L.classify(rom,rows[0]).kind,'VETOR-INDIRETO');
const learned=L.learn(rom,rows,hash);
assert.strictEqual(learned.accepted.length,1);assert.strictEqual(learned.rejected.length,2);
assert(learned.hintsText.includes('target=009000 from=00800a kind=FLOW e=0 m=0 x=0 c=?'));

// pilha nativa grande (sessoes longas acumulam frames C++ de retornos redirecionados)
{const g=F.generateProject(rom,F.analyze(rom,64));assert(g['src/forja_stack.cpp']&&g['src/forja_stack.cpp'].includes('RLIMIT_STACK'),'forja_stack.cpp ausente');
 assert(g['CMakeLists.txt'].includes('/STACK:1073741824')&&g['CMakeLists.txt'].includes('-Wl,--stack,1073741824')&&g['CMakeLists.txt'].includes('src/forja_stack.cpp'),'CMake sem pilha grande');
 const before=g['CMakeLists.txt'];F.attachLargeStack(g);assert.strictEqual(g['CMakeLists.txt'],before,'attachLargeStack idempotente');}
if(process.platform==='win32'||process.env.FORJA65_SKIP_NATIVE_TESTS){console.log('interpreter-learning-v0436135: unidades OK (compilacao pulada)');process.exit(0);}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-learn-'));
const build=(port,exe)=>{const src=path.join(port,'src'),objs=[];
  for(const f of fs.readdirSync(src).filter(f=>f.endsWith('.cpp'))){const o=path.join(port,f+'.o');cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-w','-I'+src,'-c',path.join(src,f),'-o',o]);objs.push(o);}
  cp.execFileSync(process.env.CXX||'g++',[...objs,'-o',exe,'-lpthread']);};
const run=(port,exe,tag)=>{const out=path.join(dir,tag);fs.mkdirSync(out,{recursive:true});fs.symlinkSync(path.join(port,'assets'),path.join(out,'assets'));
  const r=cp.spawnSync(exe,[],{cwd:out,encoding:'utf8',timeout:120000,env:{...process.env,FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:'40',FORJA65_FRAME_HASHES:'1',FORJA65_FRAME_HASH_PATH:path.join(out,'h.txt')}});
  assert.strictEqual(r.status,0,'port '+tag+' falhou: '+(r.stderr||'').slice(-400));
  const h=fs.readFileSync(path.join(out,'h.txt'),'utf8').split('\n').filter(l=>l.startsWith('frame=')).map(l=>l.match(/wram=([0-9a-f]+)/)[1]);
  const log=path.join(out,'forja65-cpu-interpreter.txt');return {h,log:fs.existsSync(log)?fs.readFileSync(log,'utf8'):''};};
try{
  fs.writeFileSync(path.join(dir,'rom.sfc'),Buffer.from(bytes));
  const port=path.join(dir,'port');const files=F.generateProject(rom,F.analyze(rom,4096));
  for(const [k,v] of Object.entries(files)){const f=path.join(port,k);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}
  assert(!/^\{0x009000u,/m.test(files['src/dispatch.cpp']),'a analise estatica nao deveria conhecer $9000');
  build(port,path.join(dir,'antes.bin'));const a=run(port,path.join(dir,'antes.bin'),'antes');
  assert(/^009000 M0X0 from=00800A count=\d+/m.test(a.log),'interpretador deveria registrar $9000: '+a.log.slice(0,300));
  fs.writeFileSync(path.join(dir,'interp.txt'),a.log);
  const out=cp.execFileSync('node',[path.join(root,'tools','learn-from-interpreter.js'),'--rom',path.join(dir,'rom.sfc'),'--log',path.join(dir,'interp.txt'),
    '--out',path.join(dir,'learn'),'--port',port,'--budget','4096','--tag','t135'],{encoding:'utf8'});
  const rep=JSON.parse(fs.readFileSync(path.join(dir,'learn','forja65-learned-report.json'),'utf8'));
  assert(rep.integracao&&rep.integracao.rotinas>=1&&rep.integracao.linhas>=1,'integracao vazia: '+out);
  assert(/^\{0x009000u,false,false,false,[a-z]+,[a-z]+,&sub_009000_E0M0X0C[01Q]_t135,0x009000u\},$/m.test(fs.readFileSync(path.join(port,'src','dispatch.cpp'),'utf8')),'linha de dispatch de $9000 ausente');
  // integrar de novo com a mesma tag e recusado (idempotencia explicita)
  assert.throws(()=>cp.execFileSync('node',[path.join(root,'tools','learn-from-interpreter.js'),'--rom',path.join(dir,'rom.sfc'),'--log',path.join(dir,'interp.txt'),'--out',path.join(dir,'learn2'),'--port',port,'--budget','4096','--tag','t135'],{stdio:'pipe'}));
  build(port,path.join(dir,'depois.bin'));const b=run(port,path.join(dir,'depois.bin'),'depois');
  assert(!/^009000 /m.test(b.log),'depois da integracao $9000 deve rodar nativo: '+b.log.slice(0,300));
  assert.deepStrictEqual(b.h,a.h,'WRAM deve ser identica quadro a quadro (interpretado x nativo)');
  console.log('interpreter-learning-v0436135: PASS ('+a.h.length+' quadros com WRAM identica; $9000 passou de interpretado para nativo)');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
