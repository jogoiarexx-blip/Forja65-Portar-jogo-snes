'use strict';
// Equivalence to Forja's bounded full-poll model, not a hardware oracle.
const crypto=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const baseline=process.env.FORJA65_IRQ_FULLPOLL||path.join(__dirname,'reference/irq-fullpoll-v043667.js');
// This historical check pins BOTH v67 implementations. Current IRQ behavior
// is validated separately by irq-sparse-equivalence-v043685-regression.js.
const sparse=process.env.FORJA65_IRQ_ARCHIVE_SPARSE||path.join(__dirname,'reference/irq-sparse-v043667.js');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(sparse)).digest('hex'),'7d1effc50793aa5ae5f11ee85c99f26b502f98d813c568c49f52542465924a2a','frozen historical sparse reference hash');
assert.equal(require(sparse).VERSION,'0.4.36.67-spc-dsp-hdma-irq-reference');
const expectedHash='369c7d7929cc6adeba76469d7148570e27f3d7f86b0e469e9b2677a3296a82de';
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(baseline)).digest('hex'),expectedHash,'frozen full-poll reference hash');
console.log('HISTORICAL_V67_ARCHIVE_ONLY; current scheduler checked by v85 regression.');
console.log('Reference sha256='+expectedHash+'; seed=0x671f35a9; 40000 operations per region/mode; regions=0,2; modes=0,1,2,3');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-irq-sparse-'));
try{
 for(const opt of ['-O0','-O2']){
  const outputs=[];
  for(const [tag,file] of [['full',baseline],['sparse',sparse]]){
   const F=require(file),rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,128));
   const work=path.join(dir,tag);fs.mkdirSync(work,{recursive:true});
   for(const n of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(work,n),files['src/'+n]);
   fs.copyFileSync(path.join(__dirname,'fixtures/irq-sparse-equivalence-v043667.cpp'),path.join(work,'probe.cpp'));
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
