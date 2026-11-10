#!/usr/bin/env node
'use strict';
// Generic deterministic milestone audit for generated native-PC ports.
// A completed replay proves frames executed, not stage completion or hardware equivalence.
const fs=require('node:fs'),path=require('node:path');
function assert(ok,message){if(!ok)throw Error(message);}
function lines(source){return source.trimEnd().split(/\r?\n/).filter(Boolean);}
function audit(report,hashText,captureData={},opts={}){
  const milestone=Number(opts.frames||5000);
  assert(Number.isSafeInteger(milestone)&&milestone>=1&&milestone<=1000000,'Invalid milestone frame count');
  assert(report&&report.status==='FRAMES_REACHED','Replay has not completed the target');
  assert(Number(report.requested_frames)===milestone,'Replay target differs from milestone');
  const good=(report.iterations||[]).findLast(r=>r.run?.exit_code===0 && r.frames===milestone && r.last_frame===milestone-1);
  assert(good,'No successful replay with the required number of frames');
  const hashes=lines(hashText);
  assert(hashes.length===milestone,'Frame hashes incomplete or mixed between sessions');
  const gfx=new Set(),wram=new Set();let changesSince=0,previous=null;
  const changeFrom=Number(opts.changeFrom??Math.max(0,milestone-500));
  assert(Number.isSafeInteger(changeFrom)&&changeFrom>=0&&changeFrom<milestone,'Invalid changeFrom');
  for(let i=0;i<hashes.length;i++){
    const m=/^frame=(\d+) framebuffer=([a-f\d]{1,16}) wram=([a-f\d]{1,16}) pc=([a-f\d]+)$/i.exec(hashes[i]);
    assert(m,'Invalid frame hash entry '+i);
    assert(Number(m[1])===i,'Missing, duplicated, or unordered frame '+i);
    gfx.add(m[2]);wram.add(m[3]);
    if(i>=changeFrom&&previous!==null&&previous!==m[2])changesSince++;
    previous=m[2];
  }
  assert(gfx.size===good.unique_framebuffers,'Framebuffer count differs from report');
  assert(wram.size===good.unique_wram,'WRAM count differs from report');
  assert(changesSince>0,'No visual change in the monitored last segment');
  const required=opts.captureFrames||[];
  const cartHashes=new Set(),snapshots=[];
  for(const frame of required){
    assert(Number.isSafeInteger(frame)&&frame>=0&&frame<milestone,'Capture frame outside milestone');
    const manifest=captureData[frame];
    assert(typeof manifest==='string','Missing capture of frame '+frame);
    assert(manifest.startsWith('FORJA65_SCENE_CAPTURE 1\n'),'Invalid scene manifest '+frame);
    const src=manifest.match(/^source_frame=(\d+)$/m);
    assert(src&&Number(src[1])===frame,'Capture does not match requested frame '+frame);
    const cart=manifest.match(/^cart_hash_fnv1a64=([a-f0-9]{16})$/m);
    assert(cart,'ROM fingerprint missing in frame '+frame);
    cartHashes.add(cart[1]);snapshots.push(frame);
  }
  assert(cartHashes.size<=1,'Capture ROM identity mismatch');
  return {schema:1,status:'MILESTONE_VERIFIED',target_frames:milestone,frames_executed:hashes.length,exit_code:good.run.exit_code,
    framebuffer_variants:gfx.size,wram_variants:wram.size,visual_changes_after_frame:changeFrom,visual_change_count:changesSince,
    captures_checked:snapshots,rom_fingerprint:[...cartHashes][0]||null,
    claim:'Deterministic native replay completed; this does not establish stage completion, collision correctness or SNES pixel equivalence.'};
}
function cli(args){
  const o={};for(let i=0;i<args.length;i+=2){assert(args[i]?.startsWith('--')&&args[i+1],'Expected --option value');o[args[i].slice(2)]=args[i+1];}
  for(const n of ['report','hashes','out'])assert(o[n],'Missing --'+n);
  const captureFrames=(o.captures||'').split(',').filter(Boolean).map(Number);
  const captureData={};if(captureFrames.length){assert(o['capture-root'],'Missing --capture-root');for(const f of captureFrames){
    captureData[f]=fs.readFileSync(path.resolve(o['capture-root'],`frame-${f}`,'capture-manifest.txt'),'utf8');}}
  const result=audit(JSON.parse(fs.readFileSync(path.resolve(o.report),'utf8')),fs.readFileSync(path.resolve(o.hashes),'utf8'),captureData,
    {frames:Number(o.frames||5000),changeFrom:o['change-from']===undefined?undefined:Number(o['change-from']),captureFrames});
  fs.mkdirSync(path.dirname(path.resolve(o.out)),{recursive:true});fs.writeFileSync(path.resolve(o.out),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}
if(require.main===module){try{cli(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={audit,cli};
