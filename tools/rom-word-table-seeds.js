#!/usr/bin/env node
'use strict';
// AOT candidates from explicit, ROM-verified little-endian 16-bit jump tables.
// The caller supplies a LoROM target bank; this is NOT runtime evidence.
const fs=require('node:fs'),path=require('node:path'),C=require('../forja65-core');
function numeric(x){if(!/^(?:0x[0-9a-f]+|\d+)$/i.test(String(x)))throw Error('Invalid address '+x);return Number(x);}
function readRanges(bytes,defs){
 const ranges=[],byAddress=new Map();
 for(const def of defs){const {start,end,bank}=def;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>bytes.length||end<=start||(end-start)%2||end-start<6||!Number.isInteger(bank)||bank<0||bank>0x7d)throw Error('Invalid 16-bit table bounds or bank');
  const candidates=[];
  for(let i=start;i<end;i+=2){const word=bytes[i]|bytes[i+1]<<8;const target=(bank<<16)|word;
   if(word<0x8000||bank*0x8000+(word&0x7fff)>=bytes.length)throw Error('Non-ROM pointer at file offset 0x'+i.toString(16));
   candidates.push(target);if(!byAddress.has(target))byAddress.set(target,{address:target,offsets:[]});byAddress.get(target).offsets.push(i);
  }
  ranges.push({start,end,bank,pointers:candidates.length,unique:new Set(candidates).size});
 }
 return {ranges,entries:[...byAddress.values()].sort((a,b)=>a.address-b.address)};
}
function prepare(project,opts){
 const bytes=fs.readFileSync(path.join(project,'assets/cart-data.bin'));
 const rom=C.loadRom(new Uint8Array(bytes),'cart-data.bin'),hash=C.romFingerprint(rom),site=opts.source;
 const off=((site>>>16)&0x7f)*0x8000+(site&0x7fff);
 if(!(site&0x8000)||off+3>bytes.length||bytes[off]!==0xdc)throw Error('Source is not JML [$dp] in ROM');
 const candidates=readRanges(bytes,opts.ranges),st={emulation:false,m8:true,x8:true,carry:false};
 const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{tool:'rom-word-table-seeds',version:1},
 entries:candidates.entries.map(e=>({address:e.address,name:'rom_word_candidate_'+e.address.toString(16).toUpperCase(),category:'SCRIPT',priority:2,state:st,source:'speculative_lorom_16bit_pointer_not_observed',evidence:[`Explicit ROM word-table entries at offsets ${e.offsets.map(x=>'0x'+x.toString(16)).join(', ')}`,'NOT proof of executable boundaries or observed runtime']})),
 dataRegions:[],dispatch:[{site,targets:candidates.entries.map(e=>e.address),source:'speculative_rom_word_pointer_table_not_observed'}],limits:['Unobserved ROM candidates, never runtime hints.','A table bank is supplied by caller and remains a testable hypothesis.']};
 const audit={schema:1,rom:hash,source:site,ranges:candidates.ranges,candidateCount:candidates.entries.length,tableEntries:candidates.ranges.reduce((n,x)=>n+x.pointers,0),entries:candidates.entries};
 return {pack,audit};
}
function main(argv){
 const a={};for(let i=0;i<argv.length;i+=2){if(!argv[i].startsWith('--')||!argv[i+1])throw Error('Expected --project --source --ranges [--apply yes]');a[argv[i].slice(2)]=argv[i+1];}
 if(!a.project||!a.source||!a.ranges)throw Error('Missing project/source/ranges');
 const project=path.resolve(a.project),source=numeric(a.source),ranges=a.ranges.split(';').map(x=>{const [s,e,b]=x.split(':');if(!b)throw Error('Each range needs start:end:bank');return {start:numeric(s),end:numeric(e),bank:numeric(b)};});
 const {pack,audit}=prepare(project,{source,ranges});const reports=path.join(project,'reports');fs.mkdirSync(reports,{recursive:true});fs.writeFileSync(path.join(reports,'rom-word-table-seeds.json'),JSON.stringify(audit,null,2)+'\n');
 if(a.apply==='yes'){
  const file=path.join(project,'analysis/knowledge-pack.json');let k=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):pack;
  if(k.rom?.fnv1a64!==audit.rom)throw Error('Knowledge ROM mismatch');
  const existing=new Set((k.entries||[]).map(e=>`${e.address}|${JSON.stringify(e.state)}`));
  for(const e of pack.entries){const key=`${e.address}|${JSON.stringify(e.state)}`;if(!existing.has(key)){k.entries.push(e);existing.add(key);}}
  const d=(k.dispatch||[]).find(x=>x.site===source);
  if(d){if(d.source!=='speculative_rom_word_pointer_table_not_observed')throw Error('Dispatch provenance mismatch');d.targets=[...new Set([...d.targets,...pack.dispatch[0].targets])].sort((x,y)=>x-y);}
  else {k.dispatch=k.dispatch||[];k.dispatch.push(...pack.dispatch);}
  fs.writeFileSync(file,JSON.stringify(k,null,2)+'\n');
 }
 console.log(`ROM ${audit.rom}: ${audit.tableEntries} words, ${audit.candidateCount} candidates; applied=${a.apply==='yes'}`);
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.stack);process.exitCode=2;}}
module.exports={readRanges,prepare};
