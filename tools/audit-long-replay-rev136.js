#!/usr/bin/env node
'use strict';
// REV136: evidence-based long headless QA; does not infer game completion
// from process exit or a still picture. General-purpose for generated ports.
const fs=require('node:fs'),path=require('node:path');
function requireArg(ok,why){if(!ok)throw Error(why);}
function status(s){const m={};for(const l of s.split(/\r?\n/)){const k=l.indexOf('=');if(k>0)m[l.slice(0,k)]=l.slice(k+1);}return m;}
function analyze(progress,qa,learning,goal){
  requireArg(Number.isInteger(goal)&&goal>0,'invalid goal');
  const lines=progress.trim().split(/\r?\n/);
  const names=lines.shift().trim().split(',');
  const ix=Object.fromEntries(names.map((n,i)=>[n,i]));
  for(const n of ['frame','pc','instructions','fb_fnv1a64'])requireArg(Number.isInteger(ix[n]),'missing CSV field '+n);
  const rows=lines.filter(Boolean).map(l=>{
    const v=l.split(',');return {frame:Number(v[ix.frame]),pc:v[ix.pc].toLowerCase(),instructions:Number(v[ix.instructions]),image:v[ix.fb_fnv1a64].toLowerCase()};
  });
  requireArg(rows.length>0,'no progress samples');
  let lastFrame=0,lastInstructions=0,visualChanges=0,pcChanges=0,hashVariants=new Set(),hot={};
  let maxSampleGap=0,maxInstructionsPerFrame=0,minInstructionsPerFrame=Infinity;
  for(let k=0;k<rows.length;k++){const r=rows[k];
    requireArg(Number.isSafeInteger(r.frame)&&r.frame>lastFrame&&r.frame<=goal,'invalid/overshooting frame');
    requireArg(Number.isSafeInteger(r.instructions)&&r.instructions>=lastInstructions,'instructions not monotone');
    requireArg(/^[\da-f]{1,16}$/.test(r.image),'invalid framebuffer hash');
    if(lastFrame){const df=r.frame-lastFrame,di=r.instructions-lastInstructions;
      maxSampleGap=Math.max(maxSampleGap,df);const rate=di/df;
      maxInstructionsPerFrame=Math.max(maxInstructionsPerFrame,rate);minInstructionsPerFrame=Math.min(minInstructionsPerFrame,rate);
      const prev=rows[k-1];if(r.image!==prev.image)visualChanges++;if(r.pc!==prev.pc)pcChanges++;
    }
    hot[r.pc]=(hot[r.pc]||0)+1;
    hashVariants.add(r.image);lastFrame=r.frame;lastInstructions=r.instructions;
  }
  const q=status(qa),qaFrames=Number(q.frames),qaInst=Number(q.instructions),fallback=learning&&learning.includes('FORJA65_CPU_INTERPRETER 1')?learning:null;
  const fi=fallback&&/^instructions=(\d+)$/m.exec(fallback);
  const ok=q.runtime_started==='PASS'&&qaFrames===goal&&Number.isSafeInteger(qaInst)&&qaInst>=lastInstructions&&lastFrame===goal&&q.rom&&q.framebuffer_hash;
  return {schema:'forja65.long-replay.rev136/1',goal_frames:goal,pass:!!ok,reported_frames:q.frames||null,verified_progress_frames:lastFrame,reported_instructions:qaInst||null,progress_samples:rows.length,framebuffer_variants:hashVariants.size,visual_changes_between_samples:visualChanges,cpu_pc_changes_between_samples:pcChanges,peak_sampled_instructions_per_frame:Math.round(maxInstructionsPerFrame),minimum_sampled_instructions_per_frame:Math.round(minInstructionsPerFrame),max_sample_gap:maxSampleGap,hot_sampled_pcs:Object.entries(hot).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([pc,samples])=>({pc,samples})),fallback_observed:!!fallback,interpreted_instructions:fi?Number(fi[1]):0,rom_fingerprint:q.rom||null,ppu_native_accesses:Number(q.ppu_native_accesses||0),ppu_fallback_accesses:Number(q.ppu_fallback_accesses||0),dsp_native_samples:Number(q.dsp_native_samples||0),note:'A pass confirms the sampled replay length, not completion of stages/collision/scoring/audio correctness.'};
}
function cli(argv){const args={};for(let i=0;i<argv.length;i+=2){requireArg(argv[i]?.startsWith('--')&&argv[i+1],'expected --key value');args[argv[i].slice(2)]=argv[i+1];}
  for(const k of ['progress','qa','goal','out'])requireArg(args[k],'missing '+k);
  const learning=args.interpreter&&fs.existsSync(args.interpreter)?fs.readFileSync(args.interpreter,'utf8'):null;
  const report=analyze(fs.readFileSync(args.progress,'utf8'),fs.readFileSync(args.qa,'utf8'),learning,Number(args.goal));
  fs.mkdirSync(path.dirname(path.resolve(args.out)),{recursive:true});fs.writeFileSync(args.out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.pass)process.exitCode=2;
}
if(require.main===module){try{cli(process.argv.slice(2));}catch(e){console.error(e.stack||String(e));process.exitCode=2;}}
module.exports={analyze,cli};
