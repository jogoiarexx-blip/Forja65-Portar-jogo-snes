'use strict';
const cp=require('child_process'),path=require('path'),assert=require('assert/strict');
const r=cp.spawnSync(process.execPath,[path.join(__dirname,'../tools/sst65816-interpreter-conformance.js'),path.join(__dirname,'fixtures/sst65816-rev132-fixture.json.gz')],{encoding:'utf8',timeout:1800000,maxBuffer:1<<26});
process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
assert.equal(r.status,0,r.error?.message||'interpreter conformance failed');
const m=/SST65816_INTERP_CONFORMANCE cases=(\d+) state_fail=(\d+) bus_order_fail=(\d+) cycle_fail=(\d+) disputed=(\d+)/.exec(r.stdout||'');
assert(m,'summary missing');assert.equal(+m[1],3032);
assert.deepEqual(m.slice(2,5).map(Number),[0,0,0]);assert(+m[5]<=1,'new reference disagreement');
