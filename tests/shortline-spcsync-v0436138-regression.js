#!/usr/bin/env node
'use strict';
// REV138: linha curta V=240 (1360 ciclos mestres) nos quadros impares sem entrelacamento, como bsnes/Snes9x.
// Sem ela cada quadro do port durava em media 2 ciclos mestres a mais; o SPC700 adiantava ~0,1 ciclo por quadro
// em relacao a CPU e a fase do tempo da musica derivava (no SMW, o handshake de carga do Yoshi's Island 4 esperava
// 163 mil ciclos a mais que nas referencias). O teste conta iteracoes de um laco da CPU durante 240 quadros:
// com a linha curta o tempo total e 480 ciclos menor, logo o contador termina algumas iteracoes atras do modo antigo.
// Com entrelacamento ($2133 bit 0) nao ha linha curta: os dois modos devem dar o mesmo resultado.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..'),F=require(path.join(root,'forja65-core.js'));
function rom(interlace){
  const code=[0x18,0xFB,0xE2,0x30,                       // CLC XCE SEP #$30
    0xA9,interlace?0x01:0x00,0x8D,0x33,0x21,            // LDA #i ; STA $2133 (SETINI)
    0x64,0x10,0x64,0x11,                                // STZ $10 ; STZ $11
    0xE6,0x10,0xD0,0xFC,0xE6,0x11,0x80,0xF8];           // l: INC $10 ; BNE l ; INC $11 ; BRA l
  const d=F.makeSyntheticRom();d.fill(0xEA,0,0x7FC0);d.set(code,0);
  const r=F.loadRom(d,'shortline'+(interlace?'-i':'')+'.sfc');return F.generateProject(r,F.analyze(r,1024));}
const plain=rom(false),inter=rom(true);
const rt=plain['src/runtime.hpp'];
assert(rt.includes('bool forja65ShortLine(unsigned line)const')&&rt.includes('MASTER_CYCLES_PER_SCANLINE-4u'),'runtime sem linha curta V=240');
assert(rt.includes('if(c=="aram")'),'modo de controle sem o comando aram');
assert(rt.includes('FORJA65_SPCTRACE_INLINE'),'runtime sem FORJA65_SPCTRACE_INLINE');
if(process.platform==='win32'||process.env.FORJA65_SKIP_NATIVE_TESTS){console.log('shortline-spcsync-v0436138: estrutura OK (compilacao pulada)');process.exit(0);}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-shortline-'));
try{
  const build=(files,name)=>{const port=path.join(dir,name);
    for(const [k,v] of Object.entries(files)){const f=path.join(port,k);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}
    const src=path.join(port,'src'),objs=[];
    for(const f of fs.readdirSync(src).filter(f=>f.endsWith('.cpp'))){const o=path.join(dir,name+'-'+f+'.o');cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-w','-I'+src,'-c',path.join(src,f),'-o',o]);objs.push(o);}
    const exe=path.join(dir,name+'-game');cp.execFileSync(process.env.CXX||'g++',[...objs,'-o',exe,'-lpthread']);return {exe,port};};
  const run=(b,env)=>{const out=fs.mkdtempSync(path.join(dir,'run-'));fs.symlinkSync(path.join(b.port,'assets'),path.join(out,'assets'));
    const r=cp.spawnSync(b.exe,[],{cwd:out,encoding:'utf8',timeout:120000,input:'run 240 0000\nram 10 2\nquit\n',
      env:{...process.env,FORJA65_CONTROL:'1',FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:'0',FORJA65_WATCHDOG_INSTRUCTIONS:'0',
           FORJA65_EXECUTION:'reference',FORJA65_SPC_PROFILE:'reference',FORJA65_CONTROL_DIR:path.join(out,'ctl'),...env}});
    const lines=(r.stdout||'').trim().split('\n');const hex=lines[lines.length-1];
    assert(/^[0-9a-f]{4}$/.test(hex),'saida inesperada: '+r.stdout+r.stderr);const b2=Buffer.from(hex,'hex');return b2[0]|b2[1]<<8;};
  const bp=build(plain,'p'),bi=build(inter,'i');
  const now=run(bp,{}),old=run(bp,{FORJA65_SHORTLINE:'0'});
  const d=old-now;
  assert(d>=2&&d<=16,'linha curta deve tirar 480 ciclos em 240 quadros (algumas iteracoes): antigo='+old+' novo='+now);
  const i1=run(bi,{}),i0=run(bi,{FORJA65_SHORTLINE:'0'});
  assert.strictEqual(i1,i0,'com entrelacamento nao ha linha curta');
  console.log('shortline-spcsync-v0436138: PASS (iteracoes em 240 quadros: antigo='+old+' novo='+now+' diferenca='+d+'; entrelacado igual='+i1+')');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
