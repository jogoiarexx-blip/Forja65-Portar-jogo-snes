'use strict';
// REV137: este teste exercita o comparador/pipeline de IRQ com linhas do port escolhidas a mao (VTIME == linha do port).
// A REV137 alinhou o contador V ao video (V = linha do port + 1); esse mapeamento e coberto por
// tests/dsp1-vcounter-v0436137-regression.js. Aqui o mapeamento antigo e fixado para o mecanismo continuar comparavel.
process.env.FORJA65_VCOUNTER_LEGACY='1';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const F=require(process.env.FORJA65_SOURCE_CORE||'../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-irq-h85-'));
try{
 for(const n of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(dir,n),files['src/'+n]);
 for(const opt of ['-O0','-O2']){
  const exe=path.join(dir,process.platform==='win32'?'probe.exe':'probe');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,'-I'+dir,path.join(__dirname,'fixtures/irq_horizontal_v043685.cpp'),'-o',exe,...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{stdio:'inherit'});
  const p=cp.spawnSync(exe,[],{encoding:'utf8'});process.stdout.write(opt+' '+p.stdout);if(p.stderr)process.stderr.write(p.stderr);assert.equal(p.status,0);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
