#!/usr/bin/env node
'use strict';
// REV181: auditoria ESTATICA, nao promete execucao sem fallback.
const fs=require('fs'),path=require('path');
const {parseLog}=require('./learn-from-interpreter');
const hex=n=>n.toString(16).toUpperCase().padStart(6,'0');
function audit(port,frontier){
 const src=fs.readFileSync(path.join(port,'src/dispatch.cpp'),'utf8');
 const cmake=fs.readFileSync(path.join(port,'CMakeLists.txt'),'utf8');
 const rows=[];
 const re=/^\{0x([0-9A-Fa-f]+)u,(true|false),(true|false),(true|false),(true|false),(true|false),&([A-Za-z0-9_]+),0x([0-9A-Fa-f]+)u\},$/gm;
 for(let m;(m=re.exec(src));){rows.push({pc:parseInt(m[1],16),e:m[2]==='true',m:m[3]==='true',x:m[4]==='true',carryKnown:m[5]==='true',carry:m[6]==='true',fn:m[7]});}
 const input=fs.readFileSync(frontier,'utf8');
 const misses=parseLog(input);
 const carryMatch=input.match(/^#\s*reason=[^\n]*\bcarry=([01])\b/m);
 const expectedCarry=carryMatch?carryMatch[1]==='1':null;
 const results=[];
 for(const miss of misses){
   const candidates=rows.filter(r=>r.pc===miss.target&&r.e===!!miss.e&&r.m===!!miss.m&&r.x===!!miss.x);
   const compatible=candidates.filter(r=>!r.carryKnown||(expectedCarry!==null&&r.carry===expectedCarry));
   const owners=[];
   for(const r of compatible){
     const suffix=r.fn.match(/_(r\d+[a-z]?)$/i);
     const shard=suffix?`src/forja_learned_${suffix[1]}_`:'';
     if(shard){
       const listed=cmake.match(/src\/forja_learned_[A-Za-z0-9_-]+_\d{3}\.cpp/g)||[];
       const matches=listed.filter(x=>x.startsWith(shard));
       if(matches.some(x=>fs.existsSync(path.join(port,x))&&fs.readFileSync(path.join(port,x),'utf8').includes('void '+r.fn+'(')))owners.push(r.fn);
     }else owners.push(r.fn); // gerada em arquivo antigo, nao certifica corpo individual
   }
   results.push({target:hex(miss.target),state:(miss.e?'E1':'')+'M'+miss.m+'X'+miss.x,
      from:hex(miss.from),dispatchVariants:compatible.length,verifiedShardOwners:owners,
      status:owners.length?'present-static':'missing-or-unverified'});
 }
 return {schema:'forja65.aot-coverage-static.v1',frontierCount:misses.length,
   presentStatic:results.filter(x=>x.status==='present-static').length,
   missing:results.filter(x=>x.status!=='present-static').length,
   note:'Apenas cobertura de dispatcher/arquivo. Requer compilacao, replay e hashes para comprovar execucao nativa.',results};
}
if(require.main===module){
 let port,log;
 for(let i=2;i<process.argv.length;i++){if(process.argv[i]==='--port')port=process.argv[++i];else if(process.argv[i]==='--frontier')log=process.argv[++i];else throw Error('Uso: --port PATH --frontier FILE');}
 if(!port||!log)throw Error('Uso: --port PATH --frontier FILE');
 const summary=audit(path.resolve(port),path.resolve(log));console.log(JSON.stringify(summary,null,2));if(summary.missing)process.exitCode=3;
}
module.exports={audit};
