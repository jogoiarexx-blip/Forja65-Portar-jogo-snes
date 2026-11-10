#!/usr/bin/env node
'use strict';
// Find packed 24-bit LoROM pointer tables that contain at least one REAL
// runtime-observed target of a JML [$dp] site. Other entries remain speculative.
const fs=require('node:fs');
const path=require('node:path');
const C=require('../forja65-core');
const {scan}=require('./rom-pointer-table-seeds');
const SOURCE='speculative_rom_packed_pointer_table_not_observed';
function numeric(s){if(!/^(0x[\da-f]+|\d+)$/i.test(String(s)))throw Error('Invalid source '+s);return Number(s);}
function getRomOffset(addr){return ((addr>>>16)&0x7f)*0x8000+(addr&0x7fff);}
function discovery(bytes,{source,observations,minimum=4}){
 if(!Number.isSafeInteger(source)||source<0||source>0xffffff||(source&0x8000)===0)throw Error('Invalid ROM JML source');
 if(bytes[getRomOffset(source)]!==0xdc)throw Error('Source is not JML [$dp] opcode DC');
 const matching=observations.filter(h=>h.kind==='FLOW'&&h.from===source&&(h.target&0x8000)&&((h.target>>>16)&0xff)<=0x7d);
 if(!matching.length)throw Error('No verified ROM FLOW targets for this site');
 const states=new Set(matching.map(h=>JSON.stringify(h.state)));
 if(states.size!==1)throw Error('Multiple observed CPU states at source; split dispatch analysis before generating seeds');
 const state=matching[0].state;
 const banks=[...new Set(matching.map(h=>h.target>>>16))].sort((a,b)=>a-b);
 const selected=[];const all=new Map();const unmatched=[];
 for(const bank of banks){
  const observed=new Set(matching.filter(h=>h.target>>>16===bank).map(h=>h.target));
  const scanned=scan(bytes,{start:0,end:bytes.length,bank,minimum});
  const matched=new Set();
  for(const r of scanned.runs){
   const found=[];
   for(let at=r.start;at<r.end;at+=3){
    const target=bytes[at]|(bytes[at+1]<<8)|(bank<<16);
    if(observed.has(target)){found.push(target);matched.add(target);}
   }
   if(!found.length)continue;
   selected.push({bank,start:r.start,end:r.end,count:r.count,observedHits:[...new Set(found)].sort((a,b)=>a-b)});
   for(let at=r.start;at<r.end;at+=3){
    const target=bytes[at]|(bytes[at+1]<<8)|(bank<<16);
    if(!all.has(target))all.set(target,{address:target,offsets:[],observed:observed.has(target)});
    all.get(target).offsets.push(at);
   }
  }
  for(const target of observed)if(!matched.has(target))unmatched.push(target);
 }
 const entries=[...all.values()].sort((a,b)=>a.address-b.address);
 return {source,states:[state],runs:selected,entries,unmatchedObserved:unmatched.sort((a,b)=>a-b),tableEntries:selected.reduce((s,r)=>s+r.count,0)};
}
function makePack(hash,result){
 const state=result.states[0];
 return {schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{tool:'rom-observed-dispatch-tables',version:1},entries:result.entries.map(e=>({
  address:e.address,name:'rom_dispatch_candidate_'+e.address.toString(16).toUpperCase(),category:'SCRIPT',priority:2,state,
  source:SOURCE,evidence:[`Aligned 24-bit pointer(s) at ROM file offsets ${e.offsets.map(x=>'0x'+x.toString(16)).join(', ')}`,
   e.observed?'Target ALSO recorded in original ROM-bound runtime hints':'Static table member only; NOT observed in runtime']})),
  dataRegions:[],dispatch:[{site:result.source,targets:result.entries.map(e=>e.address),source:SOURCE}],
  limits:['Observed targets select table regions; OTHER table members remain hypotheses.',
   'No runtime-hints are written or fabricated. ROM fingerprints and CPU states must match.']};
}
function apply(project,pack){
 const dest=path.join(project,'analysis/knowledge-pack.json');
 const existing=fs.existsSync(dest)?JSON.parse(fs.readFileSync(dest,'utf8')):null;
 const merged=existing||pack;
 if(existing){
  if(existing.rom?.fnv1a64!==pack.rom.fnv1a64)throw Error('Knowledge ROM fingerprint mismatch');
  const d=(existing.dispatch||[]).find(x=>x.site===pack.dispatch[0].site);
  if(d&&d.source!==SOURCE)throw Error('Dispatch source provenance mismatch');
  const known=new Set((existing.entries||[]).map(e=>e.address+'|'+JSON.stringify(e.state)));
  for(const entry of pack.entries){const key=entry.address+'|'+JSON.stringify(entry.state);if(!known.has(key)){merged.entries.push(entry);known.add(key);}}
  if(d)d.targets=[...new Set([...d.targets,...pack.dispatch[0].targets])].sort((a,b)=>a-b);
  else {merged.dispatch=merged.dispatch||[];merged.dispatch.push(...pack.dispatch);}
 }
 fs.writeFileSync(dest,JSON.stringify(merged,null,2)+'\n');
 return {entries:merged.entries.length,targets:merged.dispatch.find(d=>d.site===pack.dispatch[0].site).targets.length};
}
function main(argv){
 const a={};for(let i=0;i<argv.length;i+=2){if(!argv[i].startsWith('--')||!argv[i+1])throw Error('Usage: --project PATH --source 0x00871b [--minimum 4] [--apply yes]');a[argv[i].slice(2)]=argv[i+1];}
 if(!a.project||!a.source)throw Error('Missing --project or --source');
 const project=path.resolve(a.project),bytes=fs.readFileSync(path.join(project,'assets/cart-data.bin'));
 const rom=C.loadRom(new Uint8Array(bytes),'cart-data.bin'),hash=C.romFingerprint(rom);
 const hints=C.parseRuntimeHints(fs.readFileSync(path.join(project,'analysis/runtime-hints.txt'),'utf8'));
 if(hints.some(h=>h.rom!==hash))throw Error('Runtime hints from another ROM');
 const result=discovery(bytes,{source:numeric(a.source),observations:hints,minimum:a.minimum?numeric(a.minimum):4});
 const pack=makePack(hash,result);const reports=path.join(project,'reports');fs.mkdirSync(reports,{recursive:true});
 fs.writeFileSync(path.join(reports,'rom-observed-dispatch-tables.json'),JSON.stringify({schema:1,rom:hash,...result},null,2)+'\n');
 if(a.apply==='yes')apply(project,pack);
 console.log(`Observed dispatch $${result.source.toString(16).toUpperCase()}: ${result.runs.length} matched runs, ${result.tableEntries} pointers, ${result.entries.length} unique candidates, ${result.unmatchedObserved.length} observed target(s) unmatched; applied=${a.apply==='yes'}.`);
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error('Forja65:',e.message);process.exitCode=2;}}
module.exports={discovery,makePack,apply};
