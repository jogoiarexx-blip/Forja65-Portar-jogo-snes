'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core');
const data=C.makeSyntheticRom();data[0]=0xDB;
data.set([0xA9,0x34,0x12,0xDB],0x40); // Native 16-bit LDA; emulation has 8-bit operand.
const rom=C.loadRom(data),romHash=C.romFingerprint(rom);
const st={emulation:false,m8:false,x8:false,carry:null};
const good={rom:romHash,target:0x8040,from:0x8000,kind:'FLOW',state:st,observed:2};
const issues=[
  null,
  {},
  { ...good,target:-1 },
  { ...good,target:0x1000000 },
  { ...good,target:NaN },
  { ...good,target:'0x8040' },
  { ...good,from:-1 },
  { ...good,from:0x1000000 },
  { ...good,rom:'bogus' },
  { ...good,observed:0 },
  { ...good,observed:1.5 },
  { ...good,state:{emulation:true,m8:false,x8:true,carry:true} },
  { ...good,state:{emulation:true,m8:true,x8:false,carry:true} },
  { ...good,state:{...st,x8:'false'} },
  { ...good,state:{...st,carry:1} },
  { ...good,state:{...st,emulation:'false'} },
  { ...good,state:null },
  { ...good,kind:{name:'FLOW'} },
];
let checks=0;
for (const bad of issues){
  const a=C.analyze(rom,128,[bad]);
  assert.equal(a.runtimeHintsMalformedRejected,1,'malformed object must be rejected: '+JSON.stringify(bad));
  assert.equal(a.runtimeHintsImported,0,'malformed must never seed CFG');
  assert(!a.functions.some(f=>f.start===0x8040));
  checks++;
}
const goodAnalysis=C.analyze(rom,128,[good]);
assert.equal(goodAnalysis.runtimeHintsMalformedRejected,0);
assert(goodAnalysis.functions.some(f=>f.start===0x8040&&f.entryState.m8===false));
assert(goodAnalysis.functions.some(f=>f.start===0x8040&&f.instructions.some(i=>i.pc===0x8040&&i.size===3)));
checks+=3;
const other=C.analyze(rom,128,[{...good,rom:'ffffffffffffffff'}]);
assert.equal(other.runtimeHintsRejected,1);assert.equal(other.runtimeHintsMalformedRejected,0);
assert(!other.functions.some(f=>f.start===0x8040));checks+=3;
const mixed=C.analyze(rom,128,[...issues,good]);
assert.equal(mixed.runtimeHintsMalformedRejected,issues.length);
assert(mixed.functions.some(f=>f.start===0x8040));checks+=2;
const tekst=C.analyze(rom,128,C.formatRuntimeHints([good]));
assert.deepEqual(new Set(goodAnalysis.functions.filter(f=>f.start===0x8040).map(f=>f.entryStateSig)),
 new Set(tekst.functions.filter(f=>f.start===0x8040).map(f=>f.entryStateSig)));
checks++;
// Valid unbound older observations remain accepted to preserve backwards compatibility.
const legacy=C.analyze(rom,128,[{...good,rom:''}]);
assert.equal(legacy.runtimeHintsMalformedRejected,0);assert(legacy.functions.some(f=>f.start===0x8040));checks+=2;
console.log('CFG_OBJECT_HINT_GUARD_V043689_PASS checks='+checks);
