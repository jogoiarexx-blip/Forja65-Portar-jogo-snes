'use strict';
const assert=require('node:assert/strict');
const {audit}=require('../tools/frame-milestone-audit.js');
const good={status:'FRAMES_REACHED',requested_frames:3,iterations:[{frames:3,last_frame:2,run:{exit_code:0},unique_framebuffers:2,unique_wram:3}]};
const sample=['frame=0 framebuffer=aaaaaaaaaaaaaaaa wram=1111111111111111 pc=8152',
 'frame=1 framebuffer=bbbbbbbbbbbbbbbb wram=2222222222222222 pc=8152',
 'frame=2 framebuffer=bbbbbbbbbbbbbbbb wram=3333333333333333 pc=8152'].join('\n')+'\n';
const captures={2:'FORJA65_SCENE_CAPTURE 1\nsource_frame=2\ncart_hash_fnv1a64=1111111111111111\n'};
const opts={frames:3,changeFrom:0,captureFrames:[2]};
const run=(r=good,h=sample,c=captures,o=opts)=>audit(r,h,c,o);
assert.equal(run().status,'MILESTONE_VERIFIED');
assert.deepEqual(run().captures_checked,[2]);
assert.equal(run().visual_change_count,1);
assert.throws(()=>run({...good,status:'ITERATION_LIMIT'}),/not completed/);
assert.throws(()=>run({...good,requested_frames:4}),/target differs/);
assert.throws(()=>run({...good,iterations:[{...good.iterations[0],run:{exit_code:2}}]}),/No successful/);
assert.throws(()=>run(good,sample.replace('frame=1','frame=0')),/Missing, duplicated/);
assert.throws(()=>run(good,sample.split('\n').slice(0,2).join('\n')),/hashes incomplete/);
assert.throws(()=>run(good,sample.replace('bbbbbbbbbbbbbbbb','cccccccccccccccc')),/Framebuffer count differs/);
assert.throws(()=>run(good,sample.replace('3333333333333333','2222222222222222')),/WRAM count differs/);
assert.throws(()=>run(good,sample,{2:captures[2].replace('source_frame=2','source_frame=1')}),/does not match/);
assert.throws(()=>run(good,sample,{}),/Missing capture/);
assert.throws(()=>run(good,sample,{2:captures[2]},{...opts,changeFrom:2}),/No visual change/);
console.log('PASS frame milestone audit v0.12 (12 assertions)');
