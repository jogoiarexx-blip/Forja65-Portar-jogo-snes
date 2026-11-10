'use strict';
// REV132: SPC700 interpreter + SPC AOT conformance on 6,400 SingleStepTests/spc700 vectors.
const cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const core=process.env.FORJA65_TEST_CORE||path.join(__dirname,'..','forja65-core.js');
const r=cp.spawnSync(process.execPath,[path.join(__dirname,'..','tools','spc700-sst-conformance.js'),path.join(__dirname,'fixtures','spc700-rev132-fixture.json.gz'),'--core',core],{encoding:'utf8',timeout:1800000});
process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
const get=(re)=>{const m=re.exec(r.stdout||'');assert.ok(m,'missing '+re);return m.slice(1).map(Number);};
const [semVectors,semFail]=get(/profile=corrected_semantics vectors=(\d+) state_fail=(\d+)/);
const [,refFail,refCyc]=get(/profile=reference vectors=(\d+) state_fail=(\d+) cycle_fail=(\d+)/);
const [aotVectors,,aotFail]=get(/SPC700_AOT vectors=(\d+) opcodes=(\d+) state_fail=(\d+)/);
console.log(`SPC700_SST_V0436132 interp_vectors=${semVectors} corrected_fail=${semFail} reference_fail=${refFail}/${refCyc} aot_vectors=${aotVectors} aot_fail=${aotFail} nota_aot=${(10*(aotVectors-aotFail)/aotVectors).toFixed(2)}/10`);
if(!process.env.FORJA65_SCORE_ONLY){assert.equal(semFail,0);assert.equal(refFail,0);assert.equal(refCyc,0);assert.equal(aotFail,0);assert.equal(r.status,0);}
