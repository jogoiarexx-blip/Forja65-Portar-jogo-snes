#!/usr/bin/env node
'use strict';
// Compare deterministic replay evidence after a dialog-advance input.
// NEVER claim character movement based solely on framebuffer differences.
const fs=require('node:fs'),path=require('node:path');
const {parseHashes}=require('./ppu-transition-audit.js');
function parseTrace(data){
  const rows=[];let prev=-1;
  for(const line of data.split(/\r?\n/)){
    const stripped=line.trim();if(!stripped||stripped.startsWith('#'))continue;
    const m=stripped.match(/^frame=(\d+) joy1=([0-9a-f]{4}) joy2=([0-9a-f]{4})$/i);
    if(!m)throw Error('Invalid trace entry '+stripped);
    const f=Number(m[1]);if(f<=prev)throw Error('Trace frames must increase strictly');
    prev=f;rows.push({frame:f,joy1:parseInt(m[2],16),joy2:parseInt(m[3],16)});
  }
  return rows;
}
function contiguous(rows,label){
  const set=new Set();let prev=-1;
  for(const r of rows){if(!Number.isInteger(r.frame)||r.frame<=prev||set.has(r.frame))throw Error(label+' out-of-order or duplicate frames');
    if(prev>=0&&r.frame!==prev+1)throw Error(label+' missing frame after '+prev);
    set.add(r.frame);prev=r.frame;
  }
  if(!rows.length||rows[0].frame!==0)throw Error(label+' must begin with frame 0');
}
function analyze(base,variant,trace,intervention){
  contiguous(base,'baseline');contiguous(variant,'variant');
  const from=Number(intervention);
  if(!Number.isSafeInteger(from)||from<=0)throw Error('Invalid intervention');
  const changedInput=trace.some((x,i)=>x.frame===from&&x.joy1!==0) || trace.some(x=>x.frame===from&&x.joy2!==0);
  if(!changedInput)throw Error('No non-zero input at intervention frame');
  const bound=Math.min(base.length,variant.length);
  if(bound<=from)throw Error('No common frames after intervention');
  const divergences=[];let first=null,firstVisual=null,firstWram=null, visual=0,memory=0,prefix=null;
  let contiguousVisual=0,maxVisualRun=0;
  for(let n=0;n<bound;n++){
    const f=base[n],v=variant[n];if(f.frame!==n||v.frame!==n)throw Error('Frames are not zero-based continuous');
    const vd=f.framebuffer!==v.framebuffer,md=f.wram!==v.wram;
    if((vd||md)&&n<from){prefix=n;break;}
    if(vd||md){if(first===null)first=n;if(vd){visual++;if(firstVisual===null)firstVisual=n;}if(md){memory++;if(firstWram===null)firstWram=n;}}
    contiguousVisual=vd?contiguousVisual+1:0;
    if(contiguousVisual>maxVisualRun)maxVisualRun=contiguousVisual;
    if(vd&&divergences.length<100)divergences.push(n);
  }
  const status=prefix!==null?'INVALID_PREFIX':firstVisual!==null?'VISUAL_DIFFERENCE_DURING_DIALOGUE':firstWram!==null?'WRAM_ONLY':'NO_DIFFERENCE';
  return {schema:1,status,intervention:from,common_frames:bound,baseline_frames:base.length,variant_frames:variant.length,
    prefix_mismatch:prefix,first_divergence:first,first_visual_divergence:firstVisual,first_wram_divergence:firstWram,
    differing_visual_frames:visual,differing_memory_frames:memory,longest_visual_difference_run:maxVisualRun,
    sample_visual_divergence_frames:divergences,
    replay_truncated:base.length!==variant.length,
    gameplay_validated:false,
    caveat:'A changed screen can be dialog progress, menus or HUD. Verify free character movement and collision separately.'};
}
function main(argv){
  const o={};for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||!argv[i+1])throw Error('Expected --key value');o[argv[i].slice(2)]=argv[i+1];}
  for(const k of ['baseline','variant','trace','from','out'])if(!o[k])throw Error('Missing --'+k);
  const base=parseHashes(fs.readFileSync(path.resolve(o.baseline),'utf8'));
  const variant=parseHashes(fs.readFileSync(path.resolve(o.variant),'utf8'));
  const trace=parseTrace(fs.readFileSync(path.resolve(o.trace),'utf8'));
  const result=analyze(base,variant,trace,Number(o.from));
  fs.mkdirSync(path.dirname(path.resolve(o.out)),{recursive:true});fs.writeFileSync(path.resolve(o.out),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));if(result.status==='INVALID_PREFIX')process.exitCode=2;
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={parseTrace,analyze,contiguous};
