#!/usr/bin/env node
'use strict';
// REV181: instala ponte ABI 8->10 apenas em runtime legado reconhecido.
// Opt-in com --apply. O estado de IRQ fica legado, logo NAO equivale a
// migrar toda a temporizacao da CPU/PPU do gerador REV143+.
const fs=require('fs'),path=require('path');
const {verifyCpuRuntimeAbi}=require('./learn-from-interpreter');
const usage='node tools/install-legacy-cpu-abi.js --port /caminho/port [--apply]';
function install(port,apply=false){
  const file=path.join(port,'src','runtime.hpp');
  if(!fs.existsSync(file))throw new Error('runtime.hpp ausente');
  const original=fs.readFileSync(file,'utf8');
  if(original.includes('FORJA65_CPU_TIMING_ABI_REV181')){
    verifyCpuRuntimeAbi(port);return {status:'already-installed',modified:false};
  }
  const signature='  void advanceCpuInstruction(std::uint32_t pc,unsigned cpuCycles,unsigned fetchBytes,std::uint32_t dataAddr,unsigned dataAccesses,std::uint32_t auxAddr,unsigned auxAccesses,unsigned stackAccesses){';
  if(original.split(signature).length!==2)throw new Error('ABI antiga desconhecida: nenhuma alteracao realizada');
  if(/void\s+advanceCpuInstruction\s*\([^)]*dataWidth/.test(original))throw new Error('ABI moderna detectada: nenhuma alteracao realizada');
  if(original.includes('legacyInterruptTiming('))throw new Error('runtime hibrido nao reconhecido: nenhuma alteracao realizada');
  const snippet=fs.readFileSync(path.join(__dirname,'legacy-cpu-timing-bridge-r181.inc'),'utf8');
  let result=original.replace(signature,snippet+signature);
  if(!/#include\s*<optional>/.test(result)){
    const inc='#include <functional>';
    if(!result.includes(inc))throw new Error('ancora <functional> ausente, nao modificar runtime');
    result=result.replace(inc,inc+'\n#include <optional>');
  }
  if(!apply)return {status:'ready',modified:false,bytesAdded:result.length-original.length};
  // Escrever em arquivo intermediario e preservar backup sem sobrescreve-lo.
  const backup=file+'.pre-rev181.bak';
  if(fs.existsSync(backup))throw new Error('backup preexistente: recusado');
  const stage=file+'.rev181.tmp';
  if(fs.existsSync(stage))throw new Error('arquivo temporario preexistente: recusado');
  fs.writeFileSync(backup,original,{flag:'wx'});
  try{fs.writeFileSync(stage,result,{flag:'wx'});fs.renameSync(stage,file);
    verifyCpuRuntimeAbi(port);return {status:'installed',modified:true,backup};
  }catch(e){if(fs.existsSync(stage))fs.unlinkSync(stage);fs.writeFileSync(file,original);throw e;}
}
if(require.main===module){
  let port,apply=false;
  for(let i=2;i<process.argv.length;i++){
    if(process.argv[i]==='--port')port=process.argv[++i];
    else if(process.argv[i]==='--apply')apply=true;
    else throw new Error(usage);
  }
  if(!port)throw new Error(usage);
  try{console.log(JSON.stringify(install(path.resolve(port),apply),null,2));}
  catch(e){console.error(e.message);process.exitCode=2;}
}
module.exports={install};
