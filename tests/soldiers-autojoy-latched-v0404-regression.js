'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'autojoy-latch-synthetic.sfc');
const project=C.generateProject(rom,C.analyze(rom,500));
const code=project['src/runtime.hpp'];
for (const name of ['autoJoyLatched[4]','scheduleAutoJoyRead()','finishAutoJoyRead(', 'writeFrameProgress()', 'FORJA65_FRAME_PROGRESS_CSV']) {
  assert.ok(code.includes(name), `new auto-joy runtime capability missing: ${name}`);
}
assert.match(code, /if\(lo>=0x4218&&lo<=0x421F\)\{finishAutoJoyRead\(\);/);
assert.match(code, /io\.autoJoyLatched\[p\]/);
assert.match(code, /void endVblank\(\)\{finishAutoJoyRead\(true\);/);
assert.match(code, /scheduleAutoJoyRead\(\);\}\s*void beginVblank\(\)/);
assert.match(code, /frameCounter\+\+;writeFrameProgress\(\);/);
console.log('SOLDIERS_AUTOJOY_LATCHED_GENERIC_REGRESSION_PASS');
