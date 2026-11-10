#!/usr/bin/env node
'use strict';
// Compare an established deterministic replay against the prefix of an extended replay.
// Validates framebuffer, WRAM and CPU PC, not just overall counts. No game-specific state.
const fs = require('node:fs');
const path = require('node:path');
function check(value, msg) { if (!value) throw Error(msg); }
function parseHashes(contents, label) {
  const rows = String(contents).trimEnd().split(/\r?\n/);
  check(rows.length>0 && rows[0].length>0, `${label}: empty hash log`);
  return rows.map((line, i) => {
    const m = /^frame=(\d+) framebuffer=([a-f\d]{1,16}) wram=([a-f\d]{1,16}) pc=([a-f\d]+)$/i.exec(line);
    check(m, `${label}: malformed frame ${i}`);
    check(Number(m[1])===i, `${label}: missing or reordered frame ${i}`);
    return {frame:i, framebuffer:m[2].toLowerCase(), wram:m[3].toLowerCase(), pc:m[4].toLowerCase()};
  });
}
function audit(baseline, extended, opts={}) {
  const a=parseHashes(baseline,'baseline'), b=parseHashes(extended,'extended');
  const expected=Number(opts.baselineFrames ?? a.length);
  const target=Number(opts.targetFrames ?? b.length);
  check(Number.isSafeInteger(expected)&&expected>0&&a.length===expected,'Baseline frame count mismatch');
  check(Number.isSafeInteger(target)&&target>=expected&&b.length===target,'Extended frame count mismatch');
  let changes=0, pcChanges=0, previous=null;
  for(let i=0;i<a.length;i++) {
    for(const key of ['framebuffer','wram','pc']) check(a[i][key]===b[i][key],`Replay divergence frame ${i}, field ${key}`);
  }
  // Find the exact start of the final static visual run across the entire extended replay.
  // Distinguish a stable rendered scene from CPU/WRAM stagnation.
  let lastVisualChange=0;
  for(let i=1;i<b.length;i++) if(b[i].framebuffer!==b[i-1].framebuffer) lastVisualChange=i;
  const gfx=new Set(), wram=new Set();
  let sameStreak=0, longestStill=0;
  for(let i=expected;i<target;i++) {
    gfx.add(b[i].framebuffer); wram.add(b[i].wram);
    if(previous!==null && b[i].framebuffer!==previous.framebuffer) {changes++; sameStreak=0;}
    else if(previous!==null) {sameStreak++; longestStill=Math.max(longestStill,sameStreak);}
    if(previous!==null && b[i].pc!==previous.pc) pcChanges++;
    previous=b[i];
  }
  return {schema:1,status:'PREFIX_IDENTICAL',baseline_frames:expected,extended_frames:target,
    matching_prefix_frames:expected,additional_frames:target-expected,
    additional_framebuffer_variants:gfx.size,additional_wram_variants:wram.size,
    additional_visual_changes:changes,additional_pc_changes:pcChanges,
    longest_unchanged_framebuffer_run:longestStill+1,
    last_visual_change_frame:lastVisualChange,
    unchanged_framebuffer_frames_at_end:target-1-lastVisualChange,
    note:'Bitwise frame hashes, WRAM hashes and PC match over the prior replay. This does not verify SNES equivalence or stage completion.'};
}
function cli(args){
  const o={}; for(let i=0;i<args.length;i+=2){check(args[i]?.startsWith('--') && args[i+1],'Expected --name value');o[args[i].slice(2)]=args[i+1];}
  for(const required of ['baseline','extended','out'])check(o[required],`Missing --${required}`);
  const report=audit(fs.readFileSync(path.resolve(o.baseline),'utf8'),fs.readFileSync(path.resolve(o.extended),'utf8'),
    {baselineFrames:o['baseline-frames']===undefined?undefined:Number(o['baseline-frames']),targetFrames:o['target-frames']===undefined?undefined:Number(o['target-frames'])});
  fs.mkdirSync(path.dirname(path.resolve(o.out)),{recursive:true});fs.writeFileSync(path.resolve(o.out),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}
if(require.main===module){try{cli(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={audit,parseHashes,cli};
