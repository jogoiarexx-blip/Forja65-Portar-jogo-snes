'use strict';
// REV137: este teste exercita o comparador/pipeline de IRQ com linhas do port escolhidas a mao (VTIME == linha do port).
// A REV137 alinhou o contador V ao video (V = linha do port + 1); esse mapeamento e coberto por
// tests/dsp1-vcounter-v0436137-regression.js. Aqui o mapeamento antigo e fixado para o mecanismo continuar comparavel.
process.env.FORJA65_VCOUNTER_LEGACY='1';
// REV140 changes the PAL APU clock independently of IRQ polling. Compare the
// frozen IRQ models under their shared, explicitly selected legacy APU clock;
// clock-region-rev140-regression tests the new regional clock separately.
process.env.FORJA65_SPC_PROFILE='legacy';
process.env.FORJA65_DSP_CLOCK='legacy';
// Equivalence to Forja's bounded full-poll model, not a hardware oracle.
const crypto=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const baseline=process.env.FORJA65_IRQ_FULLPOLL||path.join(__dirname,'reference/irq-fullpoll-v043685.js');
const sparse=process.env.FORJA65_CORE_OVERRIDE||path.join(__dirname,'../forja65-core.js');
const expectedHash='37150f4067ba00cc439d61b24b8ebed0148390953a925f29401abba0d84f0091';
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(baseline)).digest('hex'),expectedHash,'frozen full-poll reference hash');
console.log('Reference sha256='+expectedHash+'; seed=0x671f35a9; 40000 operations per region/mode; regions=0,2; modes=0,1,2,3');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-irq-sparse-'));
// REV136: the frozen v85 full-poll reference predates REV129's audited MDR rule
// (S-CPU internal $4000-$43FF reads return the value but do not drive the external
// MDR; ares CPU::read). That rule is orthogonal to IRQ polling, so the reference is
// used with exactly that one-line rule ported; everything else stays byte-identical.
const refSource=fs.readFileSync(baseline,'utf8'),mdrOld='const auto v=readBus(a);cpuDataBus=(std::uint8_t)v;observeBus("read",a,v,dummy);return v;}';
assert.equal(refSource.split(mdrOld).length,2,'frozen reference must contain the pre-REV129 MDR read exactly once');
const derivedReference=path.join(dir,'irq-fullpoll-v043685-mdr-rev129.js');
fs.writeFileSync(derivedReference,refSource.replace(mdrOld,'const auto v=readBus(a);if((a&0x40FC00u)!=0x004000u)cpuDataBus=(std::uint8_t)v;observeBus("read",a,v,dummy);return v;}'));
try{
 for(const opt of ['-O0','-O2']){
  const outputs=[];
  for(const [tag,file] of [['full',process.env.FORJA65_IRQ_FULLPOLL?baseline:derivedReference],['sparse',sparse]]){
   const F=require(file),rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,128));
   const work=path.join(dir,tag);fs.mkdirSync(work,{recursive:true});
   for(const n of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(work,n),files['src/'+n]);
   fs.copyFileSync(path.join(__dirname,'fixtures/irq-sparse-equivalence-v043685.cpp'),path.join(work,'probe.cpp'));
   cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,'-Wall','-Wextra','-Wpedantic','-Werror','probe.cpp','-o','probe',...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{cwd:work,stdio:'inherit'});
   outputs.push(cp.execFileSync(path.join(work,'probe'),[],{cwd:work,maxBuffer:64*1024*1024}));
   if(opt==='-O2')console.log(tag+' scheduler-only 10M requested master clocks benchmark (blank PPU, halted SPC; not a full-game speed claim) (mode ms clock line mc):\n'+cp.execFileSync(path.join(work,'probe'),['benchmark'],{cwd:work,encoding:'utf8'}));
  }
  if(!outputs[0].equals(outputs[1])){
   const a=outputs[0].toString().split('\n'),b=outputs[1].toString().split('\n');
   const first=a.findIndex((line,index)=>line!==b[index]);
   assert.fail(opt+' randomized state stream diverged at checkpoint '+first+' full='+a[first]+' sparse='+b[first]);
  }
  console.log(opt+' sparse/full-poll parity: 320000 deterministic mixed I/O/elapsed checkpoints, all IRQ modes and NTSC/PAL');
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
