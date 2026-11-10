#!/usr/bin/env node
'use strict';
// Compare two real scene captures at the SAME frame; never infer collision or
// gameplay correctness from an OAM delta alone.
const fs=require('node:fs'),path=require('node:path');
function manifest(folder){
  const m=fs.readFileSync(path.join(folder,'capture-manifest.txt'),'utf8');
  const value=k=>m.match(new RegExp('(?:^|\\n)'+k+'=([^\\r\\n]+)'))?.[1];
  const f=Number(value('source_frame')),rom=value('cart_hash_fnv1a64');
  if(!Number.isSafeInteger(f)||f<0||!/^[a-f0-9]{16}$/i.test(rom||''))throw Error('Invalid capture manifest: '+folder);
  return {frame:f,rom:rom.toLowerCase(),framebuffer:value('framebuffer_hash_fnv1a64')};
}
function sprites(folder){
  const txt=fs.readFileSync(path.join(folder,'oam-sprites.txt'),'utf8');
  if(!/^FORJA65_OAM_SPRITES 2\s*$/m.test(txt))throw Error('Unknown OAM sprite format');
  const rows=new Map();
  for(const line of txt.split(/\r?\n/)){
    const m=line.match(/^slot=(\d+) x=(-?\d+) y=(-?\d+) width=(\d+) height=(\d+) tile=(\d+) attr=(\d+) hflip=([01]) vflip=([01]) visible_pixels=(\d+)$/);
    if(!m)continue;
    const [slot,x,y,width,height,tile,attr,hflip,vflip,visible_pixels]=m.slice(1).map(Number);
    if(rows.has(slot))throw Error('Duplicate OAM slot '+slot);
    rows.set(slot,{slot,x,y,width,height,tile,attr,hflip,vflip,visible_pixels});
  }
  if(rows.size<1)throw Error('No OAM sprites found in '+folder);
  return rows;
}
function compare(baseline,variant,slot){
  const a=manifest(baseline),b=manifest(variant);
  if(a.rom!==b.rom)throw Error('ROM mismatch; cannot compare captures');
  if(a.frame!==b.frame)throw Error('Different capture frames; cannot compare motion');
  const x=sprites(baseline).get(slot),y=sprites(variant).get(slot);
  if(!x||!y)throw Error('Missing OAM slot '+slot);
  const dx=y.x-x.x,dy=y.y-x.y;
  return {schema:1,rom:a.rom,frame:a.frame,slot,baseline:x,variant:y,dx,dy,
    framebuffer_changed:a.framebuffer!==b.framebuffer,
    status:dx===0&&dy===0?'NO_POSITION_CHANGE':'OAM_POSITION_CHANGED',
    caveat:'OAM deltas are render-space evidence, not proof of world coordinates, collision, or completion; check camera scrolling and source ROM.'};
}
function cli(argv){
  const flags={};for(let i=0;i<argv.length;i+=2){
    if(!argv[i]?.startsWith('--')||!argv[i+1])throw Error('Expected --argument value');flags[argv[i].slice(2)]=argv[i+1];
  }
  if(!flags.baseline||!flags.variant)throw Error('Usage: --baseline CAPTURE_DIR --variant CAPTURE_DIR [--slot 0] [--out report.json]');
  const slot=flags.slot===undefined?0:Number(flags.slot);
  if(!Number.isSafeInteger(slot)||slot<0||slot>127)throw Error('Invalid OAM slot');
  const result=compare(path.resolve(flags.baseline),path.resolve(flags.variant),slot);
  if(flags.out){fs.mkdirSync(path.dirname(path.resolve(flags.out)),{recursive:true});fs.writeFileSync(flags.out,JSON.stringify(result,null,2)+'\n');}
  console.log(JSON.stringify(result,null,2));return result;
}
if(require.main===module){try{cli(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={manifest,sprites,compare,cli};
