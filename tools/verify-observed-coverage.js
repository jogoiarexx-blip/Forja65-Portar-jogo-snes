#!/usr/bin/env node
'use strict';
// Static PC/E/M/X coverage of an observed log. Does not certify execution or equivalence.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {parseLog,verifyPortRom}=require('./learn-from-interpreter');
function verifyObservedCoverage(log,dispatch){
  const rows=parseLog(log);
  const headers={};let magic=0,observations=0;
  for(const raw of String(log).split(/\r?\n/)){
    const line=raw.trim();if(!line||line.startsWith('#'))continue;
    if(line==='FORJA65_CPU_INTERPRETER 1'){magic++;continue;}
    const h=line.match(/^(blocks|instructions)=([0-9]+)$/);
    if(h){if(h[1] in headers||!Number.isSafeInteger(Number(h[2])))throw Error('Invalid observation log header');headers[h[1]]=Number(h[2]);continue;}
    const parsed=parseLog(line);
    if(parsed.length!==1||parsed[0].e&&(!parsed[0].m||!parsed[0].x))throw Error('Invalid observation log row');
    observations++;
  }
  const total=rows.reduce((n,r)=>n+r.count,0);
  if(magic!==1||!('blocks' in headers)||!('instructions' in headers)||observations!==rows.length||!Number.isSafeInteger(total)||total!==headers.blocks)throw Error('Invalid observation log: incomplete parse or inconsistent block total');
  const region=String(dispatch).match(/static\s+const\s+Forja65DispatchEntry\s+kForja65Dispatch\s*\[\s*\]\s*=\s*\{([\s\S]*?)\n\s*\};/);
  if(!region)throw Error('Unsupported dispatch table');
  const map=new Map();
  const re=/^\s*\{\s*0x([\da-f]+)u?\s*,\s*(true|false)\s*,\s*(true|false)\s*,\s*(true|false)\s*,\s*(true|false)\s*,\s*(true|false)\s*,\s*&\w+\s*,\s*0x[\da-f]+u?\s*\},?\s*$/gim;
  for(const r of region[1].matchAll(re)){
    const key=[parseInt(r[1],16),...r.slice(2,5).map(v=>v==='true'?1:0)].join(':');
    const coverage=map.get(key)||new Set();
    if(r[5]==='false'){coverage.add(0);coverage.add(1);}else coverage.add(r[6]==='true'?1:0);
    map.set(key,coverage);
  }
  const unique=new Map(rows.map(r=>[[r.target,r.e,r.m,r.x].join(':'),r]));
  const missing=[];
  for(const [key,r] of unique)if((map.get(key)||new Set()).size!==2)missing.push({pc:r.target.toString(16).toUpperCase().padStart(6,'0'),e:r.e,m:r.m,x:r.x,reason:'missing PC/state or incomplete carry coverage'});
  return {schema:'forja65.observed-static-coverage.v1',observations:rows.length,unique_states:unique.size,covered_states:unique.size-missing.length,missing,scope:'Static dispatch coverage only; not a runtime, whole-game or equivalence certificate.'};
}
if(require.main===module){
 try{
  const a={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i],v=process.argv[i+1];if(!['--rom','--port','--log','--out'].includes(k)||!v||v.startsWith('--'))throw Error('Use --rom file --port directory --log file [--out report.json]');a[k.slice(2)]=v;}
  if(!a.rom||!a.port||!a.log)throw Error('Use --rom file --port directory --log file [--out report.json]');
  const C=require('../forja65-core');const raw=fs.readFileSync(a.rom),rom=C.loadRom(raw,path.basename(a.rom));
  const identity=verifyPortRom(a.port,rom);
  const log=fs.readFileSync(a.log,'utf8'),dispatch=fs.readFileSync(path.join(a.port,'src/dispatch.cpp'),'utf8');
  const report={...verifyObservedCoverage(log,dispatch),rom:identity,log_sha256:crypto.createHash('sha256').update(log).digest('hex'),dispatch_sha256:crypto.createHash('sha256').update(dispatch).digest('hex')};
  const text=JSON.stringify(report,null,2)+'\n';if(a.out)fs.writeFileSync(a.out,text);process.stdout.write(text);process.exitCode=report.missing.length?1:0;
 }catch(e){console.error(e.message);process.exitCode=2;}
}
module.exports={verifyObservedCoverage};
