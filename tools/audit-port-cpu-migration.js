#!/usr/bin/env node
'use strict';
// REV175 / DKC3 crossfeed: evidencia de quanto CPU ainda usa fallback.
// Somente diagnostico; NAO conta chamadas de entrada como instrucoes da CPU.
const fs=require('node:fs'),path=require('node:path');
function lines(file){
 if(!fs.existsSync(file))return null;
 return fs.readFileSync(file,'utf8').split(/\r?\n/);
}
function fields(ls){const out={};if(!ls)return out;
 for(const line of ls){const m=line.match(/^([a-z_]+)=(.+)$/);if(m)out[m[1]]=m[2].trim();}return out;
}
function count(obj,key){const s=obj[key];if(s===undefined||!/^\d+$/.test(s))return null;
 const v=Number(s);return Number.isSafeInteger(v)?v:null;
}
function analyze(dir){
 const mig=fields(lines(path.join(dir,'forja65-cpu-migration.txt')));
 const qa=fields(lines(path.join(dir,'forja65-qa-status.txt')));
 const interpLines=lines(path.join(dir,'forja65-cpu-interpreter.txt'));
 const interp=fields(interpLines);
 const issues=[];
 const total=count(mig,'total_instructions')??count(qa,'instructions');
 const interpreted=count(mig,'interpreter_instructions')??count(qa,'cpu_interpreter_instructions')??count(interp,'instructions');
 if(total===null)issues.push('total de instrucoes ausente');
 if(interpreted===null)issues.push('instrucoes interpretadas ausentes');
 if(total!==null&&interpreted!==null&&interpreted>total)issues.push('fallback maior que total da CPU');
 if(count(mig,'total_instructions')!==null&&count(qa,'instructions')!==null&&count(mig,'total_instructions')!==count(qa,'instructions'))issues.push('contagem total da QA diferente do relatorio de migracao');
 if(count(mig,'interpreter_instructions')!==null&&count(interp,'instructions')!==null&&count(mig,'interpreter_instructions')!==count(interp,'instructions'))issues.push('contagem do interpretador diferente do relatorio de migracao');
 if(qa.runtime_started&&qa.runtime_started!=='PASS')issues.push('QA nao indica runtime iniciado');
 const hotspotsLines=lines(path.join(dir,'forja65-cpu-hotspots.txt'));
 let hotspotReport=null;
 if(hotspotsLines){
   const hdr=fields(hotspotsLines);
   const enabled=hdr.enabled==='1';
   const rows=[];let sum=0;
   if(hotspotsLines[0]!=='FORJA65_CPU_HOTSPOTS 1')issues.push('formato de hotspots desconhecido');
   const overflow=count(hdr,'overflow_instructions');
   const reported=count(hdr,'instructions');
   if(overflow===null||reported===null)issues.push('contador invalido em hotspots');
   for(const line of hotspotsLines){
     if(line.startsWith('#')||!line||line.startsWith('FORJA65_')||line.includes('=')&&!line.includes('count='))continue;
     const m=line.match(/^([0-9A-Fa-f]{6}) (E1|M[01]X[01]) count=(\d+)$/);
     if(!m){issues.push('linha malformada em hotspots');continue;}
     const n=Number(m[3]);if(!Number.isSafeInteger(n)||n<=0){issues.push('contagem invalida em hotspots');continue;}
     sum+=n;rows.push({pc:m[1].toUpperCase(),state:m[2],executed_instructions:n});
   }
   if(reported!==null&&interpreted!==null&&reported!==interpreted)issues.push('hotspots diverge do contador interpretado');
   if(enabled&&reported!==null&&overflow!==null&&sum+overflow!==reported)issues.push('soma dos hotspots difere do total interpretado');
   if(!enabled&&rows.length)issues.push('hotspots desabilitado contem instrucoes');
   hotspotReport={enabled,recorded_instructions:sum,overflow_instructions:overflow,
     distinct_pc_states:rows.length,top_executed_pcs:rows.sort((a,b)=>b.executed_instructions-a.executed_instructions||a.pc.localeCompare(b.pc)).slice(0,20)};
 }
 const entries=[];
 for(const s of interpLines||[]){
  const m=s.match(/^([0-9A-Fa-f]{6}) (E1|M[01]X[01]) from=([0-9A-Fa-f]{6}) count=(\d+)$/);
  if(!m)continue;
  const n=Number(m[4]);if(!Number.isSafeInteger(n))continue;
  entries.push({pc:m[1].toUpperCase(),state:m[2],from:m[3].toUpperCase(),entry_calls:n});
 }
 const sums=new Map();for(const x of entries){const k=x.pc+' '+x.state;const y=sums.get(k)||{pc:x.pc,state:x.state,entry_calls:0,sources:0};y.entry_calls+=x.entry_calls;y.sources++;sums.set(k,y);}
 return {dir,total_instructions:total,interpreter_instructions:interpreted,
   non_interpreter_instructions:total!==null&&interpreted!==null&&total>=interpreted?total-interpreted:null,
   interpreter_percent:total>0&&interpreted!==null?Math.round(interpreted/total*10000)/100:null,
   fallback_blocks:count(interp,'blocks'),frame_count:count(qa,'frames'),
   coverage:'CPU only; no proof of gameplay completion or native PPU/APU',
   executed_pc_hotspots:hotspotReport,
   top_fallback_entries:[...sums.values()].sort((a,b)=>b.entry_calls-a.entry_calls||a.pc.localeCompare(b.pc)).slice(0,20),
   issues};
}
function run(args){
 if(!args[0]||args[0].startsWith('--'))throw Error('uso: node tools/audit-port-cpu-migration.js <pasta-resultados> [--baseline <pasta>] [--out <json>]');
 const dir=path.resolve(args[0]), i=args.indexOf('--baseline'),o=args.indexOf('--out');
 const now=analyze(dir),before=i>=0?analyze(path.resolve(args[i+1])):null;
 const out={schema:'forja65-cpu-migration-audit/1',current:now};
 if(before){out.baseline=before;out.delta_interpreter_percent=now.interpreter_percent!==null&&before.interpreter_percent!==null?Math.round((now.interpreter_percent-before.interpreter_percent)*100)/100:null;
 if(now.frame_count!==before.frame_count)out.warning='As rotas tem duracao diferente; nao use a variacao percentual isolada como prova de melhoria';}
 const txt=JSON.stringify(out,null,2)+'\n';
 if(o>=0)fs.writeFileSync(args[o+1],txt);
 process.stdout.write(txt);
 return now.issues.length?1:0;
}
if(require.main===module){try{process.exitCode=run(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={analyze,run};
