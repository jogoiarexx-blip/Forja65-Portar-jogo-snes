// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');

const vm=C.VERSION.match(/^0\.(3|4)\.(\d+)/); assert(vm&&(Number(vm[1])>3||Number(vm[2])>=25));
const merged=C.mergeRuntimeHints(
  'target=808210 from=808000 kind=FLOW e=1 m=1 x=1 c=0',
  'target=808210 from=808000 kind=FLOW e=1 m=1 x=1 c=0\n# comment\ntarget=808220 from=808000 kind=FLOW e=1 m=1 x=1 c=0'
);
const parsed=C.parseRuntimeHints(merged);
assert.equal(parsed.length,2,'semantic dedup should keep two unique hints');
const repeated=parsed.find(h=>h.target===0x808210);
assert.equal(repeated.observed,2,'duplicate hint observations should be merged');

const data=C.makeSyntheticRom();
// Reset code: JMP ($8100,X), then a small ROM table in bank $80.
data[0x0000]=0x7C; data[0x0001]=0x00; data[0x0002]=0x81;
const targets=[0x8200,0x8210,0x8220,0x8230,0x8240];
for(let i=0;i<targets.length;i++){
  const at=0x0100+i*2, lo=targets[i]&0xFFFF;
  data[at]=lo&0xFF; data[at+1]=lo>>8;
  const to=lo-0x8000;
  data[to]=0xEA; data[to+1]=0x60;
}
const rom=C.loadRom(data,'oracle-table-test.sfc');
const hint='target=808210 from=808000 kind=FLOW e=1 m=1 x=1 c=0';
const a=C.analyze(rom,4096,hint);
assert.ok(a.runtimeHintsImported>=2,'oracle should import observed target and plausible table peers');
assert.ok(a.issues.some(x=>x.kind==='ORACLE-FLOW-TABLE'),'analysis should report flow-table expansion');
assert.ok(a.functions.some(f=>f.start===0x808210),'observed target should be compiled');
assert.ok(a.functions.some(f=>targets.some(t=>f.start===(0x800000|t)) && f.start!==0x808210),'at least one neighboring table target should be compiled');

const project=C.generateProject(rom,a);
assert.ok(project['RUN-ORACLE.cmd']);
assert.ok(project['tests/oracle_learning_smoke.cpp']);
assert.ok(project['docs/ORACLE-RUNTIME.txt']);
assert.ok(project['CMakeLists.txt'].includes('oracle_learning_smoke'));
assert.ok(project['src/runtime.hpp'].includes('forja65-oracle-hints.txt'));
console.log('oracle-runtime-learning-v0325-regression: OK');
