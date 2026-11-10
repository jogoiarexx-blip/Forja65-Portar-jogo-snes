#!/usr/bin/env node
'use strict';
// Decode fresh ROM bytes; reports supply entry points and observed CPU widths only.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),F=require('../forja65-core.js');
const args=process.argv.slice(2),arg=(k,d)=>{const n=args.indexOf(k);return n<0?d:args[n+1];};
const port=path.resolve(arg('--port','.')),out=path.resolve(arg('--out',path.join(port,'analysis/legacy-observed-aot.json')));
const rom=F.loadRom(fs.readFileSync(path.join(port,'assets/cart-data.bin'))),hash=F.romFingerprint(rom);
if(rom.header.mapping!=='HiROM')throw Error('Only legacy HiROM ports are supported');
const repeated=k=>args.flatMap((v,n)=>v===k?[path.resolve(args[n+1])]:[]);
const defaults=(dir,ext)=>fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>n.endsWith(ext)).sort().map(n=>path.join(dir,n)):[];
const profiles=[...new Set([...defaults(path.join(port,'analysis/cpu-executed-profiles'),'.json'),...repeated('--cpu-profile')])].sort();
const strictFiles=[...new Set([...defaults(path.join(port,'analysis/cpu-strict-hints'),'.txt'),...repeated('--strict-hints')])].sort();
const basePath=arg('--base-analysis',null);
let base=basePath?JSON.parse(fs.readFileSync(basePath,'utf8')):null;
if(base&&(base.rom!==hash||base.mapping!=='HiROM'))throw Error('Base analysis ROM identity/mapping mismatch');
const actual=[],extraSources=[];
function addActual(pc,state,raw,meta){
 if(!Number.isInteger(pc)||pc<0||pc>0xffffff||![state.emulation,state.m8,state.x8].every(x=>typeof x==='boolean')||(state.emulation&&(!state.m8||!state.x8)))throw Error('Invalid executed CPU PC/E/M/X');
 const i=F.decodeOne(rom,pc,{...state});
 if(raw){if(!Array.isArray(raw)||raw.length!==4)throw Error('Executed CPU profile requires raw4 bytes');for(let k=0;k<4;k++){const off=F.snesToRom(rom,(pc&0xff0000)|((pc+k)&65535));if(off===null||!Number.isInteger(raw[k])||raw[k]<0||raw[k]>255||rom.data[off]!==raw[k])throw Error('Executed CPU raw ROM mismatch at '+pc.toString(16));}}
 actual.push({start:pc,entryState:state,instructions:[{pc:i.pc,raw:i.raw,size:i.size,mnemonic:i.mnemonic,stateIn:{...state}}],...meta});
}
for(const file of profiles){const q=JSON.parse(fs.readFileSync(file,'utf8'));
 if(q.schema!=='forja65.legacy-executed-cpu-profile.v1'||q.rom!==hash||q.mapping!=='HiROM'||q.romSize!==rom.data.length||!Array.isArray(q.entries))throw Error('Executed CPU profile ROM identity/schema mismatch: '+file);
 for(const e of q.entries){if(![1,2,3].includes(e.carryMask)||!Number.isSafeInteger(e.count)||e.count<1||e.stable!==true||![e.e,e.m,e.x].every(v=>v===0||v===1))throw Error('Invalid/unstable executed CPU profile entry');
  addActual(e.pc,{emulation:!!e.e,m8:!!e.m,x8:!!e.x,carry:e.carryMask===3?null:e.carryMask===2},e.raw,{executedCount:e.count,carryMask:e.carryMask});}
 extraSources.push({file:path.relative(port,file),rows:q.entries.length,kind:'executed-instructions'});
}
for(const file of strictFiles){const q=F.parseRuntimeHintsDetailed(fs.readFileSync(file,'utf8'));if(q.rejected.length)throw Error('Invalid strict CPU hints: '+JSON.stringify(q.rejected));
 for(const h of q.hints){if(h.rom!==hash)throw Error('Strict CPU hint ROM identity mismatch');addActual(h.target,h.state,null,{strictHint:true});}
 extraSources.push({file:path.relative(port,file),rows:q.hints.length,kind:'strict-hints'});
}
const files=[];function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name==='forja65-cpu-interpreter.txt')files.push(p);}}
for(const name of (base?[]:['v0.57-validation','v0.58-validation','v0.59']))walk(path.join(port,'reports',name));
const seeds=new Map(),sources=[];
for(const file of files.sort()){
 const text=fs.readFileSync(file,'utf8');let rows=0;
 for(const m of text.matchAll(/^([0-9A-F]{6}) (?:E([01])\s*)?M([01])X([01]) from=([0-9A-F]{6}) count=(\d+)$/gm)){
  const state={emulation:m[2]==='1',m8:m[3]==='1',x8:m[4]==='1',carry:null},target=parseInt(m[1],16),key=`${target}|${+state.emulation}${+state.m8}${+state.x8}`;
  if(!seeds.has(key))seeds.set(key,{rom:hash,target,from:parseInt(m[5],16),kind:'OBSERVED-LEGACY-INTERPRETER',state,observed:1});
  seeds.get(key).observed+=Number(m[6]);rows++;
 }
 sources.push({file:path.relative(port,file),rows});
}
console.log('Decoding',seeds.size,'observed entry states from',files.length,'reports');
const hints=[...seeds.values()],a=base||F.analyze(rom,Number(arg('--budget','20000')),hints,{globalCfg:false,bundledKnowledge:false});
// Focus every observed entry independently. Global exploration budget must never starve a late report entry.
const functions=[...(a.functions||[])];
for(const seed of hints){const f=F.decodeCfgFunction(rom,seed.target,Number(arg('--focus-budget','512')),seed.state);functions.push(f);}
functions.push(...actual);
const obj={schema:'forja65.legacy-observed-aot-analysis.v1',rom:hash,mapping:'HiROM',generator:F.VERSION,sources:[...(base?.sources||sources),...extraSources],observedEntries:[...(base?.observedEntries||hints),...actual.map(f=>({rom:hash,target:f.start,kind:f.strictHint?'STRICT-LEGACY-HINT':'OBSERVED-EXECUTED-INSTRUCTION',state:f.entryState,observed:f.executedCount||1}))],functions:functions.map(f=>({start:f.start,entryState:f.entryState,instructions:(f.instructions||[]).map(i=>({pc:i.pc,raw:i.raw,size:i.size,mnemonic:i.mnemonic,stateIn:i.stateIn}))}))};
if(base)obj.baseAnalysisSha256=crypto.createHash('sha256').update(fs.readFileSync(basePath)).digest('hex');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(obj,null,2)+'\n');
console.log('Wrote',out,'functions',functions.length,'instructions',obj.functions.reduce((n,f)=>n+f.instructions.length,0));
