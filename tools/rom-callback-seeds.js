#!/usr/bin/env node
'use strict';
// ROM-bound *speculative* discovery for 65816 callback tables maintained by
// LDA #imm16; STA direct-page,X. This is NOT runtime evidence or proof that
// the bytes found are executable instruction boundaries. Nothing is patched.
const fs=require('node:fs'),path=require('node:path');
const Core=require('../forja65-core.js');
function parse(args){
 const r={bank:0x81,offset:2,limit:192};
 for(let i=0;i<args.length;i+=2){const key=args[i];if(!/^--[a-z-]+$/.test(key)||!args[i+1])throw Error('Expected --key value');r[key.slice(2)]=args[i+1];}
 if(!r.project)throw Error('Usage: rom-callback-seeds.js --project PATH [--bank 81] [--offset 02] [--out PATH]');
 for(const k of ['bank','offset']){if(typeof r[k]==='string'){if(!/^[0-9a-f]{1,2}$/i.test(r[k]))throw Error('Invalid hex '+k);r[k]=parseInt(r[k],16);}}
 if(typeof r.limit==='string'){if(!/^\d+$/.test(r.limit))throw Error('Invalid limit');r.limit=Number(r.limit);}
 if(!Number.isSafeInteger(r.bank)||r.bank<0x80||r.bank>0xff||!Number.isSafeInteger(r.offset)||r.offset<0||r.offset>0xff||!Number.isSafeInteger(r.limit)||r.limit<1||r.limit>1024)throw Error('Out-of-range argument');
 r.project=path.resolve(r.project);r.out=path.resolve(r.out||path.join(r.project,'analysis/rom-callback-candidates.json'));return r;
}
function inspect(romBytes, bank,offset, alreadyDecoded=new Set(), limit=192){
 const start=(bank&0x7f)*0x8000;
 if(start+0x8000>romBytes.length)throw Error('Selected bank is not present in ROM');
 const byTarget=new Map();
 for(let i=0;i<=0x8000-5;i++){
  // 65816 encoding LDA #16-bit ; STA $02,X. These are byte-pattern
  // candidates and MUST NOT be treated as observed/verified CFG edges.
  if(romBytes[start+i]!==0xa9||romBytes[start+i+3]!==0x95||romBytes[start+i+4]!==offset)continue;
  const target16=romBytes[start+i+1]|romBytes[start+i+2]<<8;
  if(target16<0x8000)continue; // only pointers that can resolve into this LoROM bank
  const address=(bank<<16)|target16,source=(bank<<16)|(0x8000+i);
  const record=byTarget.get(address)||{address,source_pcs:[],seen_in_prior_cfg:alreadyDecoded.has(address)};
  record.source_pcs.push(source);byTarget.set(address,record);
 }
 const results=[...byTarget.values()].sort((a,b)=>Number(b.seen_in_prior_cfg)-Number(a.seen_in_prior_cfg)||b.source_pcs.length-a.source_pcs.length||a.address-b.address);
 return {total:results.length,records:results.slice(0,limit),truncated:results.length>limit};
}
function prepare(options){
 const romPath=path.join(options.project,'assets/cart-data.bin');if(!fs.existsSync(romPath))throw Error('Missing ROM');
 const bytes=fs.readFileSync(romPath),rom=Core.loadRom(new Uint8Array(bytes),'cart-data.bin');
 const hash=Core.romFingerprint(rom),cachePath=path.join(options.project,'analysis/cfg-coverage-cache.json');
 const cache=fs.existsSync(cachePath)?JSON.parse(fs.readFileSync(cachePath,'utf8')):null;
 if(cache&&cache.rom!==hash)throw Error('CFG cache ROM mismatch');
 const known=new Set();for(const f of cache?.functions||[])for(const i of f.instructions||[])known.add(i.pc);
 const result=inspect(bytes,options.bank,options.offset,known,options.limit);
 const entries=result.records.map(r=>({address:r.address,name:'static_callback_'+r.address.toString(16).toUpperCase(),category:'SCRIPT',priority:r.seen_in_prior_cfg?50:5,
  state:{emulation:false,m8:false,x8:false,carry:null},source:'unverified_rom_pattern_a9_imm16_95_dp_x',evidence:[`ROM byte pattern A9 nn nn 95 ${options.offset.toString(16).padStart(2,'0')} at ${r.source_pcs.map(x=>'$'+x.toString(16).toUpperCase()).join(', ')}`,'Static candidate only, not observed runtime call'] }));
 const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:hash},producer:{tool:'rom-callback-seeds',version:1},entries,dataRegions:[],dispatch:[],limits:['ROM pattern matches are speculative and may overlap data; runtime equivalence is unproven.','State 16-bit A/X is hypothesized for the identified callback dispatcher.','No runtime hints were fabricated.']};
 return {audit:{schema:1,rom:hash,bank:options.bank,dp_offset:options.offset,candidate_count:result.total,selected:entries.length,truncated:result.truncated,known_decoded:result.records.filter(x=>x.seen_in_prior_cfg).length,unverified:result.records.filter(x=>!x.seen_in_prior_cfg).length,candidates:result.records},pack};
}
if(require.main===module){try{const opts=parse(process.argv.slice(2)),{audit,pack}=prepare(opts);fs.mkdirSync(path.dirname(opts.out),{recursive:true});fs.writeFileSync(opts.out,JSON.stringify(audit,null,2)+'\n');const packPath=path.join(opts.project,'analysis/rom-callback-knowledge.json');fs.writeFileSync(packPath,JSON.stringify(pack,null,2)+'\n');console.log(`Speculative ROM callback targets: ${audit.selected}/${audit.candidate_count}; already decoded=${audit.known_decoded}; audit=${opts.out}; knowledge=${packPath}`);}catch(e){console.error(e.stack);process.exitCode=2;}}
module.exports={parse,inspect,prepare};
