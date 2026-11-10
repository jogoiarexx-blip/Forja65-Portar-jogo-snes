#!/usr/bin/env node
'use strict';
// Audit runtime-learned indirect destinations without guessing ROM code paths.
// Observations are evidence for the current ROM, not proof that the game is complete.
const fs=require('node:fs');
const path=require('node:path');
const C=require('../forja65-core');

function address(value){const s=String(value||'').trim().replace(/^(?:\$|0x)/i,'');
  if(!/^[0-9a-f]{1,6}$/i.test(s))throw Error('Invalid SNES address: '+value);
  return parseInt(s,16)&0xffffff;
}
function inspect(project,site){
  const romPath=path.join(project,'assets/cart-data.bin');
  const hintsPath=path.join(project,'analysis/runtime-hints.txt');
  if(!fs.existsSync(romPath)||!fs.existsSync(hintsPath))throw Error('Missing ROM or runtime-hints in project '+project);
  const rom=C.loadRom(fs.readFileSync(romPath),'cart-data.bin');
  const hash=C.romFingerprint(rom),offset=C.snesToRom(rom,site);
  if(offset===null)throw Error('Dispatcher site is not executable ROM');
  const op=rom.data[offset],opcodeName=({0xfc:'JSR (abs,X)',0x6c:'JMP (abs)',0x7c:'JMP (abs,X)',0xdc:'JML [abs]'})[op]||null;
  const observed=C.parseRuntimeHints(fs.readFileSync(hintsPath,'utf8'));
  const entries=observed.filter(h=>h.from===site&&h.kind.toUpperCase()==='FLOW');
  const rejected={different_rom:0,non_rom_destination:0};
  const targets=new Map();
  for(const h of entries){
    if(h.rom!==hash){rejected.different_rom++;continue;}
    const loc=C.snesToRom(rom,h.target);
    if(loc===null){rejected.non_rom_destination++;continue;}
    const key=h.target,old=targets.get(key)||{address:'$'+C.hex(key,6),rom_offset:'0x'+C.hex(loc,6),first_bytes:[],observations:0,states:[]};
    if(!old.first_bytes.length)old.first_bytes=Array.from(rom.data.subarray(loc,loc+8),v=>C.hex(v));
    old.observations+=h.observed;
    const state={e:!!h.state.emulation,m:!!h.state.m8,x:!!h.state.x8,c:h.state.carry};
    if(!old.states.some(s=>JSON.stringify(s)===JSON.stringify(state)))old.states.push(state);
    targets.set(key,old);
  }
  return {schema:1,rom:hash,rom_mapping:rom.header.mapping,site:'$'+C.hex(site,6),site_opcode:'0x'+C.hex(op),site_instruction:opcodeName||'other',indexed_indirect_call:op===0xfc,verified_rom_targets:targets.size,total_hint_observations:[...targets.values()].reduce((n,t)=>n+t.observations,0),rejected,targets:[...targets.values()].sort((a,b)=>b.observations-a.observations||a.address.localeCompare(b.address))};
}
function cli(args){
  let project=null,site=null,out=null;
  for(let i=0;i<args.length;i++){
    if(!['--project','--site','--out'].includes(args[i])||!args[i+1])throw Error('Usage: node indirect-site-audit.js --project PATH --site 818151 [--out FILE]');
    const opt=args[i++];if(opt==='--project')project=path.resolve(args[i]);else if(opt==='--site')site=address(args[i]);else out=path.resolve(args[i]);
  }
  if(!project||site===null)throw Error('Both --project and --site required');
  const result=inspect(project,site);const json=JSON.stringify(result,null,2)+'\n';
  if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,json);}
  else process.stdout.write(json);
  process.stderr.write('Dispatcher '+result.site+' ('+result.site_instruction+'): '+result.verified_rom_targets+' ROM-bound targets\n');
  return result;
}
if(require.main===module){try{cli(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={address,inspect,cli};
