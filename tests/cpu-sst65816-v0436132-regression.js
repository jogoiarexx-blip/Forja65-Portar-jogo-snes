'use strict';
// REV132: 65C816 recompiler conformance on 3,056 SingleStepTests/65816 vectors (MIT), all 256
// opcodes in native and emulation mode. Checks registers, memory, ordered data-bus accesses and
// CPU cycle count. Use FORJA65_TEST_CORE to score another core (e.g. REV131 baseline).
const cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const core=process.env.FORJA65_TEST_CORE||path.join(__dirname,'..','forja65-core.js');
const r=cp.spawnSync(process.execPath,[path.join(__dirname,'..','tools','sst65816-conformance.js'),path.join(__dirname,'fixtures','sst65816-rev132-fixture.json.gz'),'--core',core],{encoding:'utf8',timeout:1800000,maxBuffer:1<<26});
process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
const m=/SST65816_CONFORMANCE cases=(\d+) state_fail=(\d+) bus_order_fail=(\d+) cycle_fail=(\d+) disputed=(\d+)/.exec(r.stdout||'');
assert.ok(m,'conformance summary missing');
const [cases,state,bus,cyc,disputed]=m.slice(1).map(Number);
const score=(10*(cases-Math.max(state,bus,cyc))/cases).toFixed(2);
console.log(`CPU_SST65816_V0436132 cases=${cases} state_fail=${state} bus_fail=${bus} cycle_fail=${cyc} disputed=${disputed} nota=${score}/10`);
if(!process.env.FORJA65_SCORE_ONLY){assert.equal(cases,3032);/* 3056 vectors minus 24 WAI/STP (halt opcodes) */assert.equal(state,0);assert.equal(bus,0);assert.equal(cyc,0);assert.ok(disputed<=4,'only the documented ares (dp,X) quirk may differ');}
