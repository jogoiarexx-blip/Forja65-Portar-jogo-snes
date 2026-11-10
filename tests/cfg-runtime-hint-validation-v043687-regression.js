'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core');
const valid='target=008100 from=008000 kind=FLOW e=1 m=1 x=1 c=? observed=2';
const cases=[
 ['target=008100G from=008000 kind=FLOW e=1 m=1 x=1 c=?','invalid-target'],
 ['target=1008100 from=008000 kind=FLOW e=1 m=1 x=1 c=?','invalid-target'],
 ['target=008100 from=008000Z kind=FLOW e=1 m=1 x=1 c=?','invalid-from'],
 ['target=008100 from=1008000 kind=FLOW e=1 m=1 x=1 c=?','invalid-from'],
 ['target=008100 from=008000 kind=FLOW e=1 m=1','incomplete-cpu-state'],
 ['target=008100 from=008000 kind=FLOW e=1 m=1 x=2','incomplete-cpu-state'],
 ['target=008100 from=008000 kind=FLOW e=1 m=maybe x=1','incomplete-cpu-state'],
 ['target=008100 from=008000 kind=FLOW e=1 m=1 x=1 c=bad','incomplete-cpu-state'],
 ['target=008100 from=008000 kind=FLOW e=1 m=1 x=1 rom=fake','invalid-rom-hash'],
 ['target=008100 from=008000 kind=FLOW e=1 m=1 x=1 observed=notnumber','invalid-observation-count'],
 ['target=008100 from=008000 kind=FLOW e=1 m=1 x=1 observed=-2','invalid-observation-count'],
 ['target=008100 from=008000 kind=FLOW e=1 m=1 x=1 observed=0','invalid-observation-count'],
 ];
for(const [line,reason] of cases){
 const d=C.parseRuntimeHintsDetailed(line);assert.equal(d.hints.length,0,line);assert.deepEqual(d.rejected.map(x=>x.reason),[reason]);
}
const normal=C.parseRuntimeHintsDetailed('# comment\n'+valid+'\n'+valid+'\n');
assert.equal(normal.rejected.length,0);assert.equal(normal.hints.length,1);assert.equal(normal.hints[0].observed,4);assert.equal(normal.hints[0].state.carry,null);
assert.deepEqual(C.parseRuntimeHints(C.formatRuntimeHints(normal.hints)),normal.hints);
const rom=C.loadRom(C.makeSyntheticRom());
const hash=C.romFingerprint(rom);
const validBound=valid+' rom='+hash;
assert.equal(C.analyze(rom,2000,validBound).runtimeHintsMalformedRejected,0);
assert.equal(C.analyze(rom,2000,validBound+'\n'+cases[0][0]+'\n'+cases[4][0]).runtimeHintsMalformedRejected,2);
assert.equal(C.analyze(rom,2000,validBound+'\nrom=ffffffffffffffff '+valid).runtimeHintsRejected,1);
const mixed=C.parseRuntimeHintsDetailed('some arbitrary log\n'+valid+'\n'+cases[0][0]);
assert.equal(mixed.rejected[0].line,3);assert.equal(mixed.hints.length,1);
// Historical traces without ROM hashes stay supported, but only when E/M/X are explicit.
assert.equal(C.parseRuntimeHints('target=B28FD0 from=BBB8EB kind=STACK-RTL e=0 m=0 x=0 c=0').length,1);
const huge=C.parseRuntimeHintsDetailed('target=008100 kind=FLOW e=1 m=1 x=1 observed=999999999');
assert.equal(huge.hints[0].observed,1000000);
console.log(`CFG_RUNTIME_HINT_VALIDATION_V043687_PASS rejected=${cases.length} stable_roundtrip=1 full_state=1 rom_binding=1 diagnostics=1`);
