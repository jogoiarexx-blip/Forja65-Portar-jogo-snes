'use strict';
// Regression for a large ROM where the default 32768 instruction-variant
// ceiling is exceeded mid-convergence. A caller can opt in to a larger
// lossless ceiling without changing the default or evicting cached coverage.
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const cmd=path.join(root,'tools/forja65.js');
const invoke=(value)=>cp.spawnSync(process.execPath,[cmd,'converge',path.join(root,'__nonexistent_mmx_project__'),'--cache-limit',value],{cwd:root,encoding:'utf8'});
let r=invoke('0');assert.equal(r.status,2);assert.match(r.stderr,/cache-limit must be an integer between 1 and 1000000/);
r=invoke('1000001');assert.equal(r.status,2);assert.match(r.stderr,/cache-limit must be an integer between 1 and 1000000/);
r=invoke('131072');assert.equal(r.status,2);assert.match(r.stderr,/Generated project ROM is missing/);
const fn=require('../tools/converge');
assert.equal(fn.positive('131072','cache-limit',1000000),131072);
assert.throws(()=>fn.positive('broken','cache-limit',1000000),/cache-limit/);
console.log('CONVERGENCE_CACHE_LIMIT_OVERRIDE_PASS');
