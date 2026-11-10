#!/usr/bin/env node
'use strict';
// REV136: frames C++ de chamadas nativas mortas nao podem ficar na pilha do host.
// Dois padroes reais de jogos SNES, em ROMs sinteticas:
//  A) retorno redirecionado: JSR $9000; a rotina descarta o retorno (PLA), empilha outro (PEA) e faz RTS;
//  B) laco principal reiniciado: LDX #$01FF / TXS / JSR $9000; a rotina volta ao laco com JMP (sem RTS),
//     e o JSR seguinte reaproveita o mesmo slot da pilha SNES (frame antigo morto). Foi o que derrubava o
//     DKC3 na luta contra o Belcha (um frame morto por quadro desde a entrada no Belcha's Barn).
// Antes da REV136 a profundidade de dispatch crescia a cada volta (segfault com a pilha de 8 MB);
// agora fica constante, com WRAM identica quadro a quadro ao comportamento antigo e ao modo iterativo.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..'),F=require(path.join(root,'forja65-core.js'));
const CASES={
  A:d=>{d.set([0x18,0xFB,0xC2,0x30,0xA9,0x00,0x00,0x85,0x10,0xE6,0x10,0x20,0x00,0x90,0x80,0xF9],0);d.set([0x68,0xF4,0x08,0x80,0x60],0x1000);},
  B:d=>{d.set([0x18,0xFB,0xC2,0x30,0xA9,0x00,0x00,0x85,0x10,0xA2,0xFF,0x01,0x9A,0xE6,0x10,0x20,0x00,0x90,0x80,0xF5],0);d.set([0xE6,0x12,0x4C,0x09,0x80],0x1000);},
};
function project(name){const d=F.makeSyntheticRom();d.fill(0xEA,0,0x7FC0);CASES[name](d);const rom=F.loadRom(d,'unwind-'+name+'.sfc');return F.generateProject(rom,F.analyze(rom,4096));}
const filesA=project('A'),dd=filesA['src/dispatch.cpp'];
assert(dd.includes('Forja65DispatchDepthGuard forjaDepth')&&dd.includes('forja65_prune_stale_frames(hw)'),'dispatcher sem desenrolamento');
{const g={'src/dispatch.cpp':dd};F.attachDispatchUnwind(g);assert.strictEqual(g['src/dispatch.cpp'],dd,'attachDispatchUnwind idempotente');}
if(process.platform==='win32'||process.env.FORJA65_SKIP_NATIVE_TESTS){console.log('dispatch-unwind-v0436136: estrutura OK (compilacao pulada)');process.exit(0);}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-unwind-'));
const summary=[];
try{
  for(const name of Object.keys(CASES)){
    const files=name==='A'?filesA:project(name),port=path.join(dir,'port-'+name);
    for(const [k,v] of Object.entries(files)){const f=path.join(port,k);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}
    const src=path.join(port,'src');
    // Projetos novos usam chamadas iterativas (FORJA65_STACKLESS_CALLS=1, sem recursao C++). Ports gerados
    // antes disso (como o DKC3) chamam forja65_dispatch recursivamente em cada JSR/JSL: e o caso testado aqui.
    const build=(tag,defs)=>{const objs=[];for(const f of fs.readdirSync(src).filter(f=>f.endsWith('.cpp'))){const o=path.join(port,tag+'-'+f+'.o');cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-w',...defs,'-I'+src,'-c',path.join(src,f),'-o',o]);objs.push(o);}
      const exe=path.join(dir,name+'-'+tag+'.bin');cp.execFileSync(process.env.CXX||'g++',[...objs,'-o',exe,'-lpthread']);return exe;};
    const recursive=build('recursivo',['-DFORJA65_STACKLESS_CALLS=0']),hybrid=build('hibrido',[]);
    const run=(tag,frames,env,exe)=>{const out=path.join(dir,name+'-'+tag);fs.mkdirSync(out,{recursive:true});fs.symlinkSync(path.join(port,'assets'),path.join(out,'assets'));
      const rep=path.join(out,'depth.txt');
      const r=cp.spawnSync(exe,[],{cwd:out,encoding:'utf8',timeout:300000,env:{...process.env,FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:String(frames),FORJA65_WATCHDOG_INSTRUCTIONS:'0',
        FORJA65_FRAME_HASHES:'1',FORJA65_FRAME_HASH_PATH:path.join(out,'h.txt'),FORJA65_DISPATCH_DEPTH_REPORT:rep,...env}});
      const h=fs.existsSync(path.join(out,'h.txt'))?fs.readFileSync(path.join(out,'h.txt'),'utf8').split('\n').filter(l=>l.startsWith('frame=')).map(l=>l.match(/wram=([0-9a-f]+)/)[1]):[];
      const depth=fs.existsSync(rep)?Object.fromEntries(fs.readFileSync(rep,'utf8').trim().split('\n').map(l=>l.split('='))):{};
      return {status:r.status,signal:r.signal,h,depth,err:(r.stderr||'').slice(-300)};};
    // 1) com desenrolamento e pilha PADRAO (sem reexecucao com 1 GB): profundidade constante, sem queda
    const on=run('on',60,{FORJA65_STACK_REEXEC:'1'},recursive);
    assert.strictEqual(on.status,0,name+': port com desenrolamento caiu: '+on.signal+' '+on.err);
    assert.strictEqual(on.h.length,60);
    assert(+on.depth.max_dispatch_depth<=4,name+': profundidade deveria ficar constante: '+JSON.stringify(on.depth));
    const events=name==='A'?+on.depth.retired_unwinds:+on.depth.stale_frames_pruned;
    assert(events>1000,name+': o laco deveria gerar muitos frames mortos: '+JSON.stringify(on.depth));
    if(name==='B')assert(+on.depth.orphan_resumes===0,'B nunca retorna das chamadas');
    // 2) sem desenrolamento (comportamento antigo) e pilha grande: a profundidade cresce a cada volta
    const off=run('off',8,{FORJA65_UNWIND_RETIRED:'0'},recursive);
    assert.strictEqual(off.status,0,name+': referencia sem desenrolamento falhou: '+off.signal+' '+off.err);
    assert(+off.depth.max_dispatch_depth>1000,name+': sem desenrolamento a profundidade deveria crescer: '+JSON.stringify(off.depth));
    // 3) mesma execucao emulada: WRAM identica quadro a quadro
    assert.deepStrictEqual(on.h.slice(0,8),off.h,name+': WRAM deve ser identica com e sem desenrolamento');
    // 4) build padrao (runtime iterativo) e o mesmo resultado
    const hy=run('hibrido',60,{FORJA65_STACK_REEXEC:'1'},hybrid);
    assert.strictEqual(hy.status,0,name+' hibrido: '+hy.signal);assert(+hy.depth.max_dispatch_depth<=4);assert.deepStrictEqual(hy.h,on.h,name+': iterativo x recursivo');
    summary.push(`${name}: profundidade ${on.depth.max_dispatch_depth} com ${events} frames mortos em 60 quadros (pilha de 8 MB); sem desenrolar ${off.depth.max_dispatch_depth} em 8 quadros`);
  }
  console.log('dispatch-unwind-v0436136: PASS ('+summary.join('; ')+'; WRAM identica)');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
