#!/usr/bin/env node
'use strict';
// REV143: temporizacao da CPU e sincronizacao CPU/APU conferidas contra o bsnes (valores de referencia gravados
// do bsnes-libretro com a sonda forja_probe_trace, ver tools/libretro-reference/comparacao/avaliar-rev143.sh).
//  - apusync.sfc: instante absoluto (ciclo mestre desde o power-on) da ultima leitura de cada espera de porta APU
//    no boot/IPL. Depende de: sequencia de RESET (186), linha V=0 no power-on, relogio SPC 1.025.280 Hz,
//    leitura da porta no ciclo de dados. Esperado: identico ao bsnes nas 25 primeiras esperas.
//  - nmitiming.sfc: custo de entrada de NMI/IRQ (nativo 62, emulacao 54 ciclos mestres, como bsnes/Snes9x).
//  - FORJA65_TIMING_PROFILE=rev142 deve reproduzir o comportamento antigo (diferente do bsnes).
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..'),F=require(path.join(root,'forja65-core.js'));
const fx=path.join(__dirname,'fixtures','rev143');
const BSNES_APUSYNC=[50290,51158,51690,52206,52762,53278,53782,54298,54866,55370,55886,56402,56958,57474,57978,58494,59010,59566,60082,60546,61102,61670,62174,62690,63640];
function gen(file){const r=F.loadRom(new Uint8Array(fs.readFileSync(path.join(fx,file))),file);return F.generateProject(r,F.analyze(r,4096));}
const sync=gen('apusync.sfc'),nmi=gen('nmitiming.sfc'),rt=sync['src/runtime.hpp'];
for(const k of ['resetSequenceCycles()','powerOnVZeroLine()','portOutAt(unsigned i)const','chargeInterruptEntry(','finishDmaCpuSync(','hvbjoyAtReadTime(','nmiSetAfterReadTime(unsigned lag)','forja65ShortLine(unsigned line)const','forja65SpcHz()','FORJA65_TIMING_PROFILE'])
  assert(rt.includes(k),'runtime sem '+k);
if(process.platform==='win32'||process.env.FORJA65_SKIP_NATIVE_TESTS){console.log('timing-sync-rev143: estrutura OK (compilacao pulada)');process.exit(0);}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev143-'));
const LINE=1364,L=262,FR=L*LINE;
function build(files,name){const port=path.join(dir,name);
  for(const [k,v] of Object.entries(files)){const f=path.join(port,k);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}
  const src=path.join(port,'src'),objs=[];
  for(const f of fs.readdirSync(src).filter(f=>f.endsWith('.cpp'))){const o=path.join(dir,name+'-'+f+'.o');cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-w','-I'+src,'-c',path.join(src,f),'-o',o]);objs.push(o);}
  const exe=path.join(dir,name+'-game');cp.execFileSync(process.env.CXX||'g++',[...objs,'-o',exe,'-lpthread']);return {exe,port};}
function trace(b,frames,env){const out=fs.mkdtempSync(path.join(dir,'run-'));fs.symlinkSync(path.join(b.port,'assets'),path.join(out,'assets'));
  const tf=path.join(out,'cpu.trace');
  const r=cp.spawnSync(b.exe,[],{cwd:out,encoding:'utf8',timeout:300000,input:'run '+frames+' 0000\nquit\n',
    env:{...process.env,FORJA65_CONTROL:'1',FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:'0',FORJA65_WATCHDOG_INSTRUCTIONS:'0',
      FORJA65_EXECUTION:'reference',FORJA65_SPC_PROFILE:'reference',FORJA65_CONTROL_DIR:path.join(out,'ctl'),
      FORJA65_CPUTRACE_FILE:tf,FORJA65_CPUTRACE_COUNT:'300000',...env}});
  assert(fs.existsSync(tf),'sem traco: '+r.stdout+r.stderr);
  const T=[];let base=0,prev=null;
  for(const l of fs.readFileSync(tf,'utf8').split('\n')){const f=l.trim().split(/\s+/);if(f.length<4||f[0]==='S')continue;
    const t=((Number(f[2])+1)%L)*LINE+Number(f[3]);if(prev!==null&&t+base<prev-FR/2)base+=FR;prev=t+base;T.push([parseInt(f[0],16),t+base]);}
  return T;}
function waitExits(T,rom){const ex=[];let cur=null;
  const isPort=pc=>{if((pc&0xFFFF)<0x8000)return false;const o=pc&0x7FFF;const op=rom[o];return [0xAD,0xCD,0x2C].includes(op)&&rom[o+2]===0x21&&rom[o+1]>=0x40&&rom[o+1]<=0x43;};
  T.forEach(([pc,t],i)=>{if(!isPort(pc))return;if(cur&&cur.pc===pc&&i-cur.i<=8){cur.t=t;cur.i=i;cur.n++;return;}if(cur&&cur.n>=2)ex.push(cur.t);cur={pc,t,i,n:1};});
  return ex;}
function entries(T,handlers){const cost=new Map(),res={};
  const d=i=>((T[i+1][1]-T[i][1])%FR+FR)%FR;
  for(let i=0;i+1<T.length;i++)if(!handlers.includes(T[i+1][0])){const m=cost.get(T[i][0])||new Map();m.set(d(i),(m.get(d(i))||0)+1);cost.set(T[i][0],m);}
  const typ=pc=>{const m=cost.get(pc);if(!m)return null;return [...m.entries()].sort((a,b)=>b[1]-a[1])[0][0];};
  for(let i=0;i+1<T.length;i++)if(handlers.includes(T[i+1][0])&&!handlers.includes(T[i][0])){const c=typ(T[i][0]);if(c===null)continue;const e=d(i)-c;if(e>40&&e<400){(res[T[i+1][0]]=res[T[i+1][0]]||new Set()).add(e);}}
  return res;}
try{
  const romSync=fs.readFileSync(path.join(fx,'apusync.sfc')),romNmi=fs.readFileSync(path.join(fx,'nmitiming.sfc'));
  const bs=build(sync,'sync');
  const now=waitExits(trace(bs,19,{}),romSync).slice(0,BSNES_APUSYNC.length);
  assert.deepStrictEqual(now,BSNES_APUSYNC,'apusync: esperas de porta APU diferentes do bsnes\nport: '+now.join(' '));
  const old=waitExits(trace(bs,19,{FORJA65_TIMING_PROFILE:'rev142'}),romSync).slice(0,BSNES_APUSYNC.length);
  assert.notDeepStrictEqual(old,BSNES_APUSYNC,'perfil rev142 deveria manter a temporizacao antiga');
  const bn=build(nmi,'nmi');
  const w=a=>a[0x7FE0+a.length*0]|0;const vec=o=>romNmi[0x7FE0+o]|(romNmi[0x7FE1+o]<<8);
  const nat=[vec(0xA),vec(0xE)],emu=[vec(0x1A),vec(0x1E)];
  const e=entries(trace(bn,30,{}),[...nat,...emu]);
  for(const h of emu)assert(e[h]&&[...e[h]].every(x=>x===54),'entrada em modo emulacao deve custar 54: '+JSON.stringify([...(e[h]||[])]));
  const natSeen=nat.filter(h=>e[h]);assert(natSeen.length>0,'nenhuma interrupcao nativa observada');
  for(const h of natSeen)assert([...e[h]].every(x=>x===62),'entrada nativa deve custar 62: '+JSON.stringify([...e[h]]));
  const el=entries(trace(bn,30,{FORJA65_INTERRUPT_TIMING:'legacy'}),[...nat,...emu]);
  for(const h of emu)assert(!el[h]||![...el[h]].includes(54),'modo legacy deveria manter 42');
  console.log('timing-sync-rev143: PASS (apusync identico ao bsnes em '+BSNES_APUSYNC.length+' esperas; rev142 difere; NMI/IRQ nativo 62, emulacao 54)');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
