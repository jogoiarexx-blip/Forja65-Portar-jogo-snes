#!/usr/bin/env node
'use strict';
// REV134: modo de controle remoto do port (FORJA65_CONTROL=1).
// Gera um port da ROM sintetica, compila, e confere pelo protocolo stdin/stdout:
//  - "run N MASK" avanca exatamente N quadros;
//  - "save"/"load" (fork) restauram o estado: mesma WRAM e mesmo quadro depois de restaurar;
//  - a execucao a partir do estado restaurado e deterministica.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
if(process.platform==='win32'){console.log('runtime-control-v0436134: pulado no Windows (savestate usa fork)');process.exit(0);}
const root=path.join(__dirname,'..');
const F=require(path.join(root,'forja65-core.js'));
const rom=F.loadRom(F.makeSyntheticRom(),'control-test.sfc');
const files=F.generateProject(rom,F.analyze(rom,64));
assert(files['src/runtime.hpp'].includes('void SnesRuntime::controlFrame()'),'runtime sem modo de controle');
// REV138/REV143: com FORJA65_CONTROL_AT=vblank o gancho de fim de quadro passou a ser condicional.
assert(/if\(controlMode(&&!controlAtVblank)?\)controlFrame\(\);/.test(files['src/runtime.hpp']),'gancho de quadro ausente');
assert(files['src/runtime.hpp'].includes('forja65ControlReadLine'),'stdin do modo de controle deve ser lido sem buffer (fork + pipe)');
{ // port com o trecho antigo (fgets em stdin) e atualizado pelo integrador; aplicar de novo nao muda nada
  const t=files['src/runtime.hpp'],i=t.indexOf('// ---- Forja65 REV134: modo de controle remoto');
  const old=t.slice(i).replace(/inline bool forja65ControlReadLine[^\n]*\n/,'').replace('forja65ControlReadLine(line,sizeof line)','std::fgets(line,sizeof line,stdin)').split('forja65ControlSend(').join('forja65ControlSendV1(');
  const f2={'src/runtime.hpp':t.slice(0,i)+old};F.attachRuntimeControl(f2);assert.strictEqual(f2['src/runtime.hpp'],t,'integrador deve atualizar o trecho antigo');
  const f3={'src/runtime.hpp':t};F.attachRuntimeControl(f3);assert.strictEqual(f3['src/runtime.hpp'],t,'integrador idempotente');
}
if(process.env.FORJA65_SKIP_NATIVE_TESTS){console.log('runtime-control-v0436134: estrutura OK (compilacao pulada)');process.exit(0);}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-control-'));
try{
  for(const [k,v] of Object.entries(files)){const f=path.join(dir,k);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}
  const src=path.join(dir,'src'),flags=['-std=c++20','-O0','-w','-I'+src],objs=[];
  for(const k of Object.keys(files).filter(k=>/^src\/.*\.cpp$/.test(k))){const o=path.join(dir,k.replace(/\.cpp$/,'.o'));cp.execFileSync(process.env.CXX||'g++',[...flags,'-c',path.join(dir,k),'-o',o]);objs.push(o);}
  const exe=path.join(dir,'port');cp.execFileSync(process.env.CXX||'g++',[...objs,'-o',exe,'-lpthread']);
  const script=['run 30 0000','frame','save a','run 50 0100','ram 0 40','frame','load a','frame','run 50 0100','ram 0 40','frame','quit'].join('\n')+'\n';
  const r=cp.spawnSync(exe,[],{cwd:dir,input:script,encoding:'utf8',timeout:120000,
    env:{...process.env,FORJA65_CONTROL:'1',FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:'0',FORJA65_CONTROL_DIR:path.join(dir,'ctl')}});
  if(process.env.DEBUG_CONTROL)console.log(JSON.stringify(r.stdout),r.stderr.slice(-500));
  const out=(r.stdout||'').trim().split('\n').filter(l=>l.length);
  // ready, ok(run30), frame, ok(save), ok(run50), ram, frame, ok(load), frame, ok(run50), ram, frame
  assert(out[0].startsWith('ready'),'sem "ready": '+out.join('|'));
  const f0=+out[0].split(' ')[1];
  assert.strictEqual(+out[2],f0+30,'run 30 deve avancar 30 quadros');
  assert.strictEqual(out[3],'ok','save');
  assert.strictEqual(+out[6],f0+80,'quadro apos 30+50');
  assert(out[7].startsWith('ok'),'load deve responder ok');
  assert.strictEqual(+out[8],f0+30,'load volta ao quadro salvo');
  assert.strictEqual(out[10],out[5],'mesma WRAM ao repetir a partir do estado restaurado');
  assert.strictEqual(+out[11],f0+80);
  // REV135: salvar varias vezes no mesmo ID nao pode deixar um guardiao antigo responder ao "load"
  const steps=[];for(let k=0;k<25;k++)steps.push('save b','run 3 0000');steps.push('frame','load b','frame','del b','load b','quit');
  const r2=cp.spawnSync(exe,[],{cwd:dir,input:steps.join('\n')+'\n',encoding:'utf8',timeout:120000,
    env:{...process.env,FORJA65_CONTROL:'1',FORJA65_HEADLESS:'1',FORJA65_HEADLESS_FRAMES:'0',FORJA65_CONTROL_DIR:path.join(dir,'ctl2')}});
  const o2=(r2.stdout||'').trim().split('\n').filter(l=>l.length);
  const fEnd=+o2[o2.length-5],loaded=+o2[o2.length-4].split(' ')[1],after=+o2[o2.length-3];assert.strictEqual(o2[o2.length-2],'ok','del');
  assert.strictEqual(loaded,fEnd-3,'load deve voltar ao ULTIMO save do mesmo ID');assert.strictEqual(after,fEnd-3);
  assert.strictEqual(o2[o2.length-1],'err','load de um ID apagado deve responder err (sem travar)');
  console.log('runtime-control-v0436134: PASS (run/save/load deterministicos; save repetido no mesmo ID sem corrida)');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
