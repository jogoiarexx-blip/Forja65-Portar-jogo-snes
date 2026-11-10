const fs=require('node:fs');const assert=require('node:assert/strict');const path=require('node:path');
const core=fs.readFileSync(path.join(__dirname,'..','forja65-core.js'),'utf8');
assert(core.includes('void appendCx4FrameAudit(){'));
assert(core.includes('FORJA65_CX4_FRAME_AUDIT'));
assert(core.includes('cx4_instructions_executed(cx4Device.get())'));
assert(core.includes('frameCounter++;writeFrameProgress();appendCx4FrameAudit();'));
assert(core.includes('cx4_rdrom_distinct(cx4Device.get())'));
console.log('REV163_CX4_FRAME_AUDIT_GENERATOR_PASS');
