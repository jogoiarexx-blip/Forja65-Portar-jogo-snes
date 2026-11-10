#!/usr/bin/env node
'use strict';
// Speculative ROM-grounded seed discovery for a 65C816 JML [$dp] dispatch
// through packed 24-bit LoROM pointer tables. NEVER fabricate runtime hints.
const fs=require('node:fs'),path=require('node:path'),C=require('../forja65-core');
function integer(s){if(typeof s==='number')return s;if(!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(String(s)))throw Error('Invalid numeric argument '+s);return Number(s);}
function scan(bytes,{start,end,bank,minimum=3}){
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>bytes.length||end<=start)throw Error('Scan bounds outside cartridge');
 if(!Number.isInteger(bank)||bank<0||bank>0x7d)throw Error('Bank must be LoROM 00..7D');
 if(!Number.isInteger(minimum)||minimum<3||minimum>1024)throw Error('minimum must be 3..1024');
 const valid=(i)=>i+2<end&&bytes[i+2]===bank&&(bytes[i+1]&0x80)!==0;
 const all=[];
 for(let i=start;i+minimum*3<=end;i++){
  let k=i;while(valid(k))k+=3;
  if((k-i)/3>=minimum)all.push({start:i,end:k,count:(k-i)/3});
 }
 // Retain maximal runs only, so arbitrary shifted positions within one run
 // cannot reinterpret padding/data as additional evidence.
 const runs=[];
 for(const item of all.sort((a,b)=>a.start-b.start||b.end-a.end)){
  if(!runs.some(r=>r.start<=item.start&&r.end>=item.end))runs.push(item);
 }
 const entries=new Map();for(const r of runs)for(let i=r.start;i<r.end;i+=3){
  const target=bytes[i]|(bytes[i+1]<<8)|(bank<<16);
  const off=(bank*0x8000)+(target&0x7fff);
  if(off>=bytes.length)continue;
  if(!entries.has(target))entries.set(target,{address:target,offsets:[]});
  entries.get(target).offsets.push(i);
 }
 return {runs,entries:[...entries.values()].sort((a,b)=>a.address-b.address)};
}
function prepare(project,opts){
 const romPath=path.join(project,'assets/cart-data.bin');const bytes=fs.readFileSync(romPath);
 const rom=C.loadRom(new Uint8Array(bytes),'cart-data.bin');const fingerprint=C.romFingerprint(rom);
 const source=opts.source;
 const sourceFileOffset=((source>>>16)&0x7f)*0x8000+(source&0x7fff);
 if((source&0x8000)===0||sourceFileOffset+3>bytes.length||bytes[sourceFileOffset]!==0xdc)
  throw Error('Source is not a ROM JML [$dp] (DC) instruction');
 const candidates=scan(bytes,opts);
 const state={emulation:false,m8:true,x8:true,carry:false};
 const entries=candidates.entries.map(item=>({address:item.address,name:'rom_pointer_candidate_'+item.address.toString(16).toUpperCase(),category:'SCRIPT',priority:2,state,
  source:'speculative_packed_lorom_24bit_table_not_runtime_observed',
  evidence:['Contiguous 24-bit pointer table: '+item.offsets.map(o=>'ROM file offset 0x'+o.toString(16).toUpperCase()).join(', '),
   'Candidate CPU M/X state from separately observed JML dispatch at $'+source.toString(16).toUpperCase()+'; individual entry has NOT been observed'] }));
 const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:fingerprint},producer:{tool:'rom-pointer-table-seeds',version:1},entries,dataRegions:[],dispatch:[{site:source,targets:candidates.entries.map(item=>item.address),source:'speculative_rom_packed_pointer_table_not_observed'}],limits:[
  'Static table entries are discovery candidates, NOT observed execution or proven CPU correctness.',
  'Only runtime traces and frame assertions can establish execution of individual targets.',
  'This tool never writes or patches original ROM, nor creates a runtime-hints observation.']};
 return {audit:{schema:1,rom:fingerprint,source:source.toString(16),bank:opts.bank,range:[opts.start,opts.end],
  runs:candidates.runs,candidateCount:entries.length,tableEntries:candidates.runs.reduce((n,r)=>n+r.count,0),
  entries:candidates.entries},pack};
}
function main(argv){
 const args={};for(let i=0;i<argv.length;i+=2){if(!argv[i].startsWith('--')||!argv[i+1])throw Error('Usage: --project PATH --start 0xOFFSET --end 0xOFFSET --bank 0x0d --source 0x00871b [--apply yes]');args[argv[i].slice(2)]=argv[i+1];}
 if(!args.project)throw Error('Missing --project');const project=path.resolve(args.project);
 const opts={start:integer(args.start),end:integer(args.end),bank:integer(args.bank),source:integer(args.source),minimum:integer(args.minimum||'3')};
 const {pack,audit}=prepare(project,opts);const reports=path.join(project,'reports');fs.mkdirSync(reports,{recursive:true});
 fs.writeFileSync(path.join(reports,'rom-pointer-table-seeds.json'),JSON.stringify(audit,null,2)+'\n');
 if(args.apply==='yes'){
  const file=path.join(project,'analysis/knowledge-pack.json');
  if(fs.existsSync(file)){
   const old=JSON.parse(fs.readFileSync(file,'utf8'));
   if(old.rom?.fnv1a64!==audit.rom)throw Error('Existing knowledge belongs to another ROM');
   const existing=new Set(old.entries.map(e=>e.address));old.entries.push(...pack.entries.filter(e=>!existing.has(e.address)));
   const dispatchSites=new Set((old.dispatch||[]).map(d=>d.site));
   if(!dispatchSites.has(opts.source)){old.dispatch=old.dispatch||[];old.dispatch.push(...pack.dispatch);}
   else {const existingDispatch=old.dispatch.find(d=>d.site===opts.source);
    if(existingDispatch.source!=='speculative_rom_packed_pointer_table_not_observed')throw Error('Refusing to modify a nonstatic dispatch source');
    existingDispatch.targets=[...new Set([...existingDispatch.targets,...pack.dispatch[0].targets])].sort((a,b)=>a-b);}
   fs.writeFileSync(file,JSON.stringify(old,null,2)+'\n');
  }else fs.writeFileSync(file,JSON.stringify(pack,null,2)+'\n');
 }
 process.stdout.write(`ROM ${audit.rom}: ${audit.tableEntries} pointers, ${audit.candidateCount} unique candidate targets across ${audit.runs.length} runs; applied=${args.apply==='yes'}\n`);
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={scan,prepare};
