'use strict';
const assert=require('node:assert/strict');
const {audit,parseHashes}=require('../tools/replay-prefix-audit.js');
const entries=[
  'frame=0 framebuffer=1111111111111111 wram=1111111111111111 pc=800001',
  'frame=1 framebuffer=1111111111111111 wram=2222222222222222 pc=800002',
  'frame=2 framebuffer=2222222222222222 wram=3333333333333333 pc=800003',
  'frame=3 framebuffer=3333333333333333 wram=4444444444444444 pc=800004',
];
const baseline=entries.slice(0,2).join('\n')+'\n', extended=entries.join('\n')+'\n';
const exec=(a=baseline,b=extended,opts={baselineFrames:2,targetFrames:4})=>audit(a,b,opts);
assert.equal(exec().status,'PREFIX_IDENTICAL');
assert.equal(exec().matching_prefix_frames,2);
assert.equal(exec().additional_frames,2);
assert.equal(exec().additional_visual_changes,1);
assert.equal(exec().additional_wram_variants,2);
assert.equal(exec().additional_pc_changes,1);
assert.equal(exec().last_visual_change_frame,3);
assert.equal(exec().unchanged_framebuffer_frames_at_end,0);
assert.equal(parseHashes(baseline,'test').length,2);
assert.throws(()=>exec(baseline,extended.replace('frame=1 framebuffer=1111','frame=1 framebuffer=aaaa')),/Replay divergence/);
assert.throws(()=>exec(baseline,extended.replace('pc=800002','pc=800008')),/Replay divergence/);
assert.throws(()=>exec(baseline,extended.replace('wram=2222222222222222','wram=ffffffffffffffff')),/Replay divergence/);
assert.throws(()=>exec(baseline,entries.slice(0,3).join('\n')+'\n'),/Extended frame count mismatch/);
assert.throws(()=>exec(baseline,extended.replace('frame=2','frame=9')),/reordered/);
assert.throws(()=>exec(baseline,extended,{baselineFrames:3,targetFrames:4}),/Baseline frame count mismatch/);
assert.throws(()=>exec('BAD\n',extended),/malformed/);
console.log('PASS replay prefix audit v0.13 (16 assertions)');
