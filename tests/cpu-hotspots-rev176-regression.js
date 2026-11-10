'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {analyze}=require('../tools/audit-port-cpu-migration.js');
const core=require('../forja65-core.js');
const generated=core.buildCpuInterpreterSource();
assert.ok(generated.includes('FORJA65_CPU_HOTSPOTS 1'), 'generated C++ must provide report');
assert.ok(generated.includes('forja65_count_hotspot(stats,pc,si)'), 'generated interpreter must update histogram only on executed step');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev176-'));
try {
 fs.writeFileSync(path.join(dir,'forja65-cpu-migration.txt'),'FORJA65_CPU_MIGRATION 1\ntotal_instructions=100\ninterpreter_instructions=12\nother_instructions=88\n');
 fs.writeFileSync(path.join(dir,'forja65-qa-status.txt'),'FORJA65_QA 1\nruntime_started=PASS\nframes=200\ninstructions=100\ncpu_interpreter_instructions=12\n');
 fs.writeFileSync(path.join(dir,'forja65-cpu-interpreter.txt'),'FORJA65_CPU_INTERPRETER 1\nblocks=2\ninstructions=12\n# entry\nB68140 E1 from=008000 count=2\n');
 const report=path.join(dir,'forja65-cpu-hotspots.txt');
 fs.writeFileSync(report,'FORJA65_CPU_HOTSPOTS 1\nenabled=1\ninstructions=12\noverflow_instructions=1\n# pc\nB68140 E1 count=7\nB68141 M1X1 count=4\n');
 let x=analyze(dir);assert.deepEqual(x.issues,[]);assert.equal(x.executed_pc_hotspots.recorded_instructions,11);
 assert.equal(x.executed_pc_hotspots.top_executed_pcs[0].executed_instructions,7);
 fs.writeFileSync(report,'FORJA65_CPU_HOTSPOTS 1\nenabled=1\ninstructions=12\noverflow_instructions=0\n# pc\nB68140 E1 count=7\n');
 x=analyze(dir);assert.ok(x.issues.some(s=>s.includes('soma dos hotspots')));
 fs.writeFileSync(report,'FORJA65_CPU_HOTSPOTS 1\nenabled=0\ninstructions=12\noverflow_instructions=0\n# pc\n');
 x=analyze(dir);assert.deepEqual(x.issues,[]);assert.equal(x.executed_pc_hotspots.enabled,false);
 console.log('PASS REV176 generator + 3 audit variants');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
