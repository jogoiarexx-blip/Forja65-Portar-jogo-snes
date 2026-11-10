#!/usr/bin/env node
'use strict';
// REV137: (1) DSP-1 de cartucho funcional (HLE) e (2) contador V alinhado ao relogio de video.
// ROM sintetica LoROM com cabecalho "ROM+DSP" ($16=$03): o codigo 65C816 manda comandos ao DSP-1
// ($20:8000 dados, $20:C000 status) e grava os resultados na WRAM; depois mede o V-IRQ com $213D.
// Antes da REV137 o primeiro acesso a $20:8000 abortava o port ("coprocessador ainda nao recompilado").
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..'),F=require(path.join(root,'forja65-core.js'));
const code=[
  0x18,0xFB,0xE2,0x30,                    // CLC XCE SEP #$30
  // Op00 (multiplicacao): $4000 * $4000 >> 15 = $2000
  0xA9,0x00,0x8F,0x00,0x80,0x20,
  0xA9,0x00,0x8F,0x00,0x80,0x20, 0xA9,0x40,0x8F,0x00,0x80,0x20,
  0xA9,0x00,0x8F,0x00,0x80,0x20, 0xA9,0x40,0x8F,0x00,0x80,0x20,
  0xAF,0x00,0x80,0x20,0x85,0x10, 0xAF,0x00,0x80,0x20,0x85,0x11,
  0xAF,0x00,0xC0,0x20,0x85,0x12,          // status (RQM=$80)
  // Op04 (seno/cosseno): angulo $4000 (90 graus), raio $7FFF -> seno ~$7FFF, cosseno ~0
  0xA9,0x04,0x8F,0x00,0x80,0x20,
  0xA9,0x00,0x8F,0x00,0x80,0x20, 0xA9,0x40,0x8F,0x00,0x80,0x20,
  0xA9,0xFF,0x8F,0x00,0x80,0x20, 0xA9,0x7F,0x8F,0x00,0x80,0x20,
  0xAF,0x00,0x80,0x20,0x85,0x13, 0xAF,0x00,0x80,0x20,0x85,0x14,
  0xAF,0x00,0x80,0x20,0x85,0x15, 0xAF,0x00,0x80,0x20,0x85,0x16,
  // V-IRQ em VTIME=100: espera o IRQ (TIMEUP em $4211) e le o contador V latched ($2137 -> $213D)
  0xA9,0x64,0x8D,0x09,0x42, 0xA9,0x00,0x8D,0x0A,0x42, 0xA9,0x20,0x8D,0x00,0x42,
  0xAD,0x11,0x42, 0x10,0xFB,              // espera TIMEUP
  0xAD,0x37,0x21, 0xAD,0x3D,0x21,0x85,0x17, 0xAD,0x3D,0x21,0x29,0x01,0x85,0x18,
  0xA9,0x00,0x8D,0x00,0x42,
  // inicio do VBlank: espera $4212.7 apagar e acender, trava o contador e le V (hardware: V=225)
  0xAD,0x12,0x42,0x30,0xFB, 0xAD,0x12,0x42,0x10,0xFB,
  0xAD,0x37,0x21, 0xAD,0x3D,0x21,0x85,0x19, 0xAD,0x3D,0x21,0x29,0x01,0x85,0x1A,
  0x80,0xFE                               // BRA *
];
function project(){const d=F.makeSyntheticRom();d.fill(0xEA,0,0x7FC0);d.set(code,0);d[0x7FD6]=0x03;
  const rom=F.loadRom(d,'dsp1-vcounter.sfc');assert.strictEqual(rom.header.coprocessor,'DSP1','cabecalho sintetico deve ser DSP-1');
  return F.generateProject(rom,F.analyze(rom,4096));}
const files=project();
assert(files['src/forja_dsp1.hpp']&&files['src/runtime.hpp'].includes('forja65_dsp1_read('),'runtime sem DSP-1');
assert(files['src/runtime.hpp'].includes('forja65VCounterOf('),'runtime sem contador V alinhado');
assert(files['src/main.cpp'].includes('forja65_trace_env_applied'),'main sem perfil do trace');
{const g={'src/runtime.hpp':files['src/runtime.hpp'],'src/main.cpp':files['src/main.cpp'],'src/forja_dsp1.hpp':files['src/forja_dsp1.hpp']};const before=JSON.stringify(g);F.attachDsp1(g);F.attachVCounterFix(g);F.attachTraceEnv(g);assert.strictEqual(JSON.stringify(g),before,'attach* idempotentes');}
{const lo=F.makeSyntheticRom();const r=F.loadRom(lo,'sem-dsp.sfc');const f=F.generateProject(r,F.analyze(r,1024));assert(!f['src/forja_dsp1.hpp'],'ROM sem DSP-1 nao recebe o modulo');}
if(process.platform==='win32'||process.env.FORJA65_SKIP_NATIVE_TESTS){console.log('dsp1-vcounter-v0436137: estrutura OK (compilacao pulada)');process.exit(0);}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dsp1-'));
try{
  const port=path.join(dir,'port');
  for(const [k,v] of Object.entries(files)){const f=path.join(port,k);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}
  const src=path.join(port,'src'),objs=[];
  for(const f of fs.readdirSync(src).filter(f=>f.endsWith('.cpp'))){const o=path.join(dir,f+'.o');cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-w','-I'+src,'-c',path.join(src,f),'-o',o]);objs.push(o);}
  const exe=path.join(dir,'game');cp.execFileSync(process.env.CXX||'g++',[...objs,'-o',exe,'-lpthread']);
  const run=(env)=>{const out=fs.mkdtempSync(path.join(dir,'run-'));fs.symlinkSync(path.join(port,'assets'),path.join(out,'assets'));
    const r=cp.spawnSync(exe,[],{cwd:out,encoding:'utf8',timeout:120000,input:'run 4 0000\nram 10 b\nquit\n',
      env:{...process.env,FORJA65_CONTROL:'1',FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:'0',FORJA65_WATCHDOG_INSTRUCTIONS:'0',FORJA65_CONTROL_DIR:path.join(out,'ctl'),...env}});
    const lines=(r.stdout||'').trim().split('\n');const hex=lines[lines.length-1];
    assert(/^[0-9a-f]{22}$/.test(hex),'saida inesperada: '+r.stdout+r.stderr);
    return [...Buffer.from(hex,'hex')];};
  const w=run({});
  assert.strictEqual(w[0]|w[1]<<8,0x2000,'Op00: $4000*$4000>>15');
  assert.strictEqual(w[2],0x80,'status do DSP-1 (RQM)');
  const sin=w[3]|w[4]<<8,cos=(w[5]|w[6]<<8)<<16>>16;
  assert(sin>=0x7FF0&&sin<=0x7FFF,'Op04 seno(90) ~ $7FFF: '+sin.toString(16));
  assert(Math.abs(cos)<=2,'Op04 cosseno(90) ~ 0: '+cos);
  assert.strictEqual(w[7]|((w[8]&1)<<8),100,'V-IRQ em VTIME=100 deve ler V=100 em $213D');
  const vblank=w[9]|((w[10]&1)<<8);
  assert(vblank===225||vblank===226,'VBlank deve comecar em V=225 (lido '+vblank+')');
  const legacy=run({FORJA65_VCOUNTER_LEGACY:'1'});
  assert.strictEqual(legacy[9]|((legacy[10]&1)<<8),vblank-1,'modo antigo: V uma linha atras (como antes da REV137)');
  console.log('dsp1-vcounter-v0436137: PASS (Op00=$2000, status=$80, Op04 seno=$'+sin.toString(16)+' cos='+cos+', V-IRQ/$213D=100, VBlank em V='+vblank+')');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
