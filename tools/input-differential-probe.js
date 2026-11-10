#!/usr/bin/env node
'use strict';
// Deterministic SNES replay comparison: differing framebuffer/WRAM after an
// injected input indicates an effect, NOT proof of gameplay or correct physics.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {parseHashes}=require('./ppu-transition-audit.js');
function compareHashes(base,variant,from){
  if(!Number.isSafeInteger(from)||from<0)throw Error('Invalid intervention frame');
  const b=new Map(base.map(r=>[r.frame,r]));const v=new Map(variant.map(r=>[r.frame,r]));
  const common=[...b.keys()].filter(n=>v.has(n)).sort((x,y)=>x-y);
  let firstMemory=null,firstVisual=null,earliestBefore=null,visualDiffFrames=0,memoryDiffFrames=0;
  for(const n of common){
    const visual=b.get(n).framebuffer!==v.get(n).framebuffer;
    const memory=b.get(n).wram!==v.get(n).wram;
    if(!visual&&!memory)continue;
    if(n<from){earliestBefore=n;break;}
    if(visual){visualDiffFrames++;if(firstVisual===null)firstVisual=n;}
    if(memory){memoryDiffFrames++;if(firstMemory===null)firstMemory=n;}
  }
  const firstDivergence=firstVisual===null?firstMemory:firstMemory===null?firstVisual:Math.min(firstVisual,firstMemory);
  const status=earliestBefore!==null?'PRE_INPUT_MISMATCH':firstVisual!==null?'VISUAL_EFFECT_OBSERVED':firstMemory!==null?'MEMORY_ONLY_EFFECT_OBSERVED':'NO_EFFECT_OBSERVED';
  return {status,first_divergence:firstDivergence,first_visual_divergence:firstVisual,first_wram_divergence:firstMemory,
    visual_frames_different:visualDiffFrames,wram_frames_different:memoryDiffFrames,
    prefix_mismatch:earliestBefore,common_frames:common.length,last_compared_frame:common.length?common.at(-1):null};
}
// Prevent a CPU/CFG crash or a truncated log from being mistaken for a successful control test.
function completeReplay(run,target){
  if(run.exit_code!==0||run.error||!Array.isArray(run.frames)||run.frames.length!==target)return false;
  return run.frames.every((row,i)=>row.frame===i && typeof row.framebuffer==='string' && typeof row.wram==='string');
}
function args(argv){const a={};for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||!argv[i+1])throw Error('Expected --argument value');a[argv[i].slice(2)]=argv[i+1];}for(const k of ['build','baseline','variant','from','frames','out'])if(!a[k])throw Error('Missing --'+k);for(const k of ['from','frames'])if(!/^[0-9]+$/.test(a[k]))throw Error('Invalid --'+k);return a;}
function execReplay(exe,build,input,frames,reportDir,tag,timeout){
  fs.rmSync(path.join(build,'forja65-frame-hashes.txt'),{force:true});
  const env={...process.env,FORJA65_HEADLESS:'1',FORJA65_UNCAPPED:'1',FORJA65_FRAME_HASHES:'1',FORJA65_HEADLESS_FRAMES:String(frames),FORJA65_INPUT_REPLAY:input};
  const t=Date.now();const r=cp.spawnSync(exe,[],{cwd:build,env,encoding:'utf8',timeout,maxBuffer:8*1024*1024});
  const h=path.join(build,'forja65-frame-hashes.txt'),save=path.join(reportDir,tag+'-frame-hashes.txt');
  const data=fs.existsSync(h)?fs.readFileSync(h,'utf8'):'';fs.writeFileSync(save,data);
  fs.writeFileSync(path.join(reportDir,tag+'-runtime.log'),(r.stdout||'')+'\n'+(r.stderr||''));
  return {exit_code:r.status,error:r.error?.message||null,elapsed_ms:Date.now()-t,frames:parseHashes(data),hash_log:save};
}
function probe(o){
  const build=path.resolve(o.build),baseline=path.resolve(o.baseline),variant=path.resolve(o.variant),report=path.resolve(o.out);
  for(const file of [baseline,variant])if(!fs.existsSync(file))throw Error('Replay missing: '+file);
  const head=(file)=>fs.readFileSync(file,'utf8').match(/FORJA65_INPUT_TRACE\s+1\s+rom=([0-9a-f]+)/i)?.[1]?.toLowerCase();
  if(!head(baseline)||head(baseline)!==head(variant))throw Error('Trace ROM identities differ');
  const exe=['game','game.exe','Release/game.exe','Debug/game.exe'].map(f=>path.join(build,f)).find(fs.existsSync);
  if(!exe||!fs.existsSync(path.join(build,'assets/cart-data.bin')))throw Error('Compiled game or runtime cart absent');
  fs.mkdirSync(report,{recursive:true});const max=Number(o.frames),start=Number(o.from);
  if(!Number.isSafeInteger(max)||start>=max||start<0)throw Error('Invalid frame window');
  const timeout=o.timeout?Number(o.timeout):120000;
  const b=execReplay(exe,build,baseline,max,report,'baseline',timeout);
  const v=execReplay(exe,build,variant,max,report,'variant',timeout);
  const compare=compareHashes(b.frames,v.frames,start);
  const complete=completeReplay(b,max)&&completeReplay(v,max);
  const result={schema:1,rom:head(baseline),intervention_frame:start,target_frames:max,
    ...compare,status:complete?compare.status:'INCOMPLETE_REPLAY',replays_complete:complete,
    baseline:{frames:b.frames.length,exit_code:b.exit_code,error:b.error,elapsed_ms:b.elapsed_ms},
    variant:{frames:v.frames.length,exit_code:v.exit_code,error:v.error,elapsed_ms:v.elapsed_ms},
    note:'Memory-only differences can be SNES input latch/WRAM changes during a cutscene, without visible character movement. Even visual differences are not proof of correct gameplay.'};
  fs.writeFileSync(path.join(report,'result.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}
if(require.main===module){try{const r=probe(args(process.argv.slice(2)));console.log(JSON.stringify(r,null,2));if(!r.replays_complete||r.status==='PRE_INPUT_MISMATCH'||r.baseline.error||r.variant.error)process.exitCode=2;}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={compareHashes,completeReplay,args,probe};
