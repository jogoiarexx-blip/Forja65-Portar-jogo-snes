#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const A=require('../tools/audit-port-cpu-migration.js');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-cpu-migration-'));
try{
 fs.writeFileSync(path.join(d,'forja65-qa-status.txt'),'FORJA65_QA 1\nruntime_started=PASS\nframes=5000\ninstructions=1000\n');
 fs.writeFileSync(path.join(d,'forja65-cpu-migration.txt'),'FORJA65_CPU_MIGRATION 1\ntotal_instructions=1000\ninterpreter_instructions=40\n');
 fs.writeFileSync(path.join(d,'forja65-cpu-interpreter.txt'),'FORJA65_CPU_INTERPRETER 1\nblocks=4\ninstructions=40\nABCDE0 M1X1 from=123456 count=3\nABCDE0 M1X1 from=654321 count=1\n');
 const r=A.analyze(d);assert.equal(r.interpreter_percent,4);assert.equal(r.top_fallback_entries[0].entry_calls,4);assert.equal(r.issues.length,0);
 fs.writeFileSync(path.join(d,'forja65-cpu-interpreter.txt'),'FORJA65_CPU_INTERPRETER 1\nblocks=0\ninstructions=0\n');
 assert.match(A.analyze(d).issues.join(';'),/diferente/);
 console.log('REV175 CPU migration audit PASS');
}finally{fs.rmSync(d,{recursive:true,force:true});}
