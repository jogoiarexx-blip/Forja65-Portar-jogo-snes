#!/usr/bin/env node
// uso: node buildport.js CORE.js ROM.sfc OUTDIR [max]   -> gera e compila o port (g++ -O1), imprime caminho do exe
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os');
const [core,romPath,out,maxArg]=process.argv.slice(2);
const F=require(path.resolve(core));
const r=F.loadRom(new Uint8Array(fs.readFileSync(romPath)),path.basename(romPath));
const a=F.analyze(r,Number(maxArg||65536));
const files=F.generateProject(r,a);
fs.rmSync(out,{recursive:true,force:true});
for(const [k,v] of Object.entries(files)){const f=path.join(out,k);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}
const src=path.join(out,'src'),objs=[];const jobs=[];
// SPC AOT: SPC_CAPS=dir1,dir2 (cada dir com spc-ram.bin + spc-capture.txt); SPC_MISSES=arquivo(s) de perfil de misses
const defs=[];
if(process.env.SPC_CAPS){
  const capFiles=d=>fs.existsSync(d+'.bin')?[d+'.bin',d+'.txt']:[path.join(d,'spc-ram.bin'),path.join(d,'spc-capture.txt')];
  const caps=process.env.SPC_CAPS.split(',').filter(Boolean).map(d=>{const [b,t]=capFiles(d);return F.loadSpcCapture(new Uint8Array(fs.readFileSync(b)),fs.readFileSync(t,'utf8'));});
  const prof=(process.env.SPC_MISSES||'').split(',').filter(Boolean).map(f=>fs.readFileSync(f,'utf8'));
  let sa;
  if(F.spcAnalyzeMulti)sa=F.spcAnalyzeMulti(caps,{max:65536,missProfiles:prof});
  else sa=F.spcAnalyze(caps[0],65536);
  const code=F.spcAnalyzeMulti?F.spcCppMulti(sa):F.spcCpp(caps[0],sa);if(F.spcMultiReportText)fs.writeFileSync(path.join(out,"spc700-aot-report.txt"),F.spcMultiReportText(sa));
  fs.writeFileSync(path.join(src,'spc700_native.cpp'),code);defs.push('-DFORJA65_NATIVE_SPC_LINKED=1');
  console.log('spc: instrucoes='+(sa.decoded||sa.instructions.length)+(sa.learned!==undefined?' aprendidas='+sa.learned:''));
}
const cpps=fs.readdirSync(src).filter(f=>f.endsWith('.cpp'));
const opt=process.env.OPT||'-O1';
// compila em paralelo (2 por vez)
const queue=[...cpps];
function compile(f){const o=path.join(out,'obj-'+f+'.o');objs.push(o);
  return new Promise((res,rej)=>{const p=cp.spawn(process.env.CXX||'g++',['-std=c++20',opt,'-w',...defs,'-I'+src,'-c',path.join(src,f),'-o',o],{stdio:'inherit'});p.on('exit',c=>c?rej(new Error(f)):res());});}
(async()=>{
  const workers=[0,1].map(async()=>{while(queue.length){await compile(queue.shift());}});
  await Promise.all(workers);
  const exe=path.join(out,'game');
  cp.execFileSync(process.env.CXX||'g++',[...objs,'-o',exe,'-lpthread']);
  console.log('decoded='+a.decoded+' exe='+exe);
})().catch(e=>{console.error(e);process.exit(1);});
