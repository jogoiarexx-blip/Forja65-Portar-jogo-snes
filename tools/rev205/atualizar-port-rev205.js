#!/usr/bin/env node
"use strict";
// Forja65 REV205: leva as mudancas de runtime da REV205 para um port ja gerado (REV198 a REV204), sem regerar CFG,
// codigo aprendido nem o SPC700 AOT. Guarda copia dos arquivos originais (*.antes-rev205) e atualiza as linhas
// file= do forja65-build-manifest.txt para as ferramentas de migracao continuarem aceitando o projeto.
//   node tools/rev205/atualizar-port-rev205.js PASTA_DO_PORT [--dry-run]
// Depois: recompile o port. As chaves FORJA65_HDMA_TIMING=legacy, FORJA65_INTERLACE_LATCH=legacy,
// FORJA65_HIRES_MATH=legacy e FORJA65_PPU_FAST=0 voltam, uma a uma, ao comportamento da REV204.
const fs=require('node:fs'),path=require('node:path');
const F=require(path.join(__dirname,'..','..','forja65-core.js'));
const dir=process.argv[2];const dry=process.argv.includes('--dry-run');
if(!dir){console.error('uso: node tools/rev205/atualizar-port-rev205.js PASTA_DO_PORT [--dry-run]');process.exit(2);}
const rtPath=path.join(dir,'src','runtime.hpp'),mainPath=path.join(dir,'src','main.cpp');
if(!fs.existsSync(rtPath)||!fs.existsSync(mainPath)){console.error('nao achei src/runtime.hpp e src/main.cpp em '+dir);process.exit(2);}
const before={'src/runtime.hpp':fs.readFileSync(rtPath,'utf8'),'src/main.cpp':fs.readFileSync(mainPath,'utf8')};
const files={...before};
const steps=[['desempenho (FORJA65_PERF)',F.attachRev205Perf],['compositor rapido do PPU',F.attachRev205PpuFast],
  ['color math em hires',F.attachRev205Hires],['temporizacao HDMA e entrelacado',F.attachRev205Timing],['enderecamento sem std::string',F.attachRev205CpuFast]];
const done=[];
for(const [name,fn] of steps){
  const rt=files['src/runtime.hpp'],mn=files['src/main.cpp'];
  try{fn(files);}catch(e){console.error('INCOMPATIBLE_RUNTIME: '+name+': '+e.message+'\nNenhum arquivo foi alterado. Gere o port de novo com a REV205 (analyze).');process.exit(2);}
  if(files['src/runtime.hpp']!==rt||files['src/main.cpp']!==mn)done.push(name);
}
if(!done.length){console.log('ALREADY_REV205 '+dir);process.exit(0);}
const fnv=b=>{let h=0xcbf29ce484222325n;for(const x of b){h^=BigInt(x);h=(h*0x100000001b3n)&0xffffffffffffffffn;}return h.toString(16).padStart(16,'0');};
console.log((dry?'DRY_RUN ':'')+'REV205 aplicado: '+done.join(', '));
if(dry)process.exit(0);
for(const [rel,text] of Object.entries(files)){
  if(text===before[rel])continue;
  const p=path.join(dir,rel);fs.writeFileSync(p+'.antes-rev205',before[rel]);fs.writeFileSync(p,text);
}
const man=path.join(dir,'forja65-build-manifest.txt');
if(fs.existsSync(man)){
  const lines=fs.readFileSync(man,'utf8').split('\n').map(l=>{
    const m=/^file=(\S+) size=\d+ fnv1a64=[0-9a-f]+$/.exec(l);if(!m||!(m[1] in files)||files[m[1]]===before[m[1]])return l;
    const b=Buffer.from(files[m[1]],'utf8');return 'file='+m[1]+' size='+b.length+' fnv1a64='+fnv(b);});
  fs.writeFileSync(man,lines.join('\n'));
}
console.log('UPDATED_REV205 '+dir+' (recompile o port)');
