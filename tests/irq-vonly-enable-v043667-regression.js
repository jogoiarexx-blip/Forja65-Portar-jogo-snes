'use strict';
// REV137: este teste exercita o comparador/pipeline de IRQ com linhas do port escolhidas a mao (VTIME == linha do port).
// A REV137 alinhou o contador V ao video (V = linha do port + 1); esse mapeamento e coberto por
// tests/dsp1-vcounter-v0436137-regression.js. Aqui o mapeamento antigo e fixado para o mecanismo continuar comparavel.
process.env.FORJA65_VCOUNTER_LEGACY='1';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require(process.env.FORJA65_CORE_OVERRIDE||'../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-v043667-irq-'));
try{
 for(const n of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(dir,n),files['src/'+n]);
 fs.copyFileSync(path.join(__dirname,'fixtures/irq_vonly_enable_v043667.cpp'),path.join(dir,'probe.cpp'));
 for(const opt of ['-O0','-O2']){
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,'-Wall','-Wextra','-Wpedantic','-Werror','probe.cpp','-o','probe'],{cwd:dir,stdio:'inherit'});
  const r=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,encoding:'utf8'});process.stdout.write(opt+' '+r.stdout);process.stderr.write(r.stderr||'');if(r.status!==0)process.exitCode=1;
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
