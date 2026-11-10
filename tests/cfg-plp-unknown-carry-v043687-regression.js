'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core');
function analyze(bytes){
  const d=C.makeSyntheticRom();d.set(bytes,0);
  const a=C.analyze(C.loadRom(d),384);
  const f=a.functions.find(x=>x.start===0x8000);
  assert(f,'reset routine missing');
  return {a,f};
}
function candidates(f,pc){return f.instructions.filter(i=>i.pc===pc&&i.mnemonic==='LDA').map(i=>({e:i.stateIn.emulation,m:i.stateIn.m8,x:i.stateIn.x8,bytes:i.size,carry:i.stateIn.carry}));}
// Emulation -> native by CLC/XCE; SEC establishes C=1, then PEA overwrites
// stack with data (not PHP). PLP must discard known C and fork XCE, not
// assume the older SEC still determines the direction of the exchange.
{
 const {f}=analyze([0x18,0xfb,0x38,0xf4,0x00,0x00,0x28,0xfb,0xa9,0x44,0xea,0xdb]);
 const cases=candidates(f,0x8008);
 assert(cases.some(x=>x.e&&x.m&&x.bytes===2),'PLP unknown: XCE must allow emulation/M8 continuation');
 assert(cases.some(x=>!x.e&&!x.m&&x.bytes===3),'PLP unknown: XCE must allow native/M16 continuation');
 assert(f.instructions.some(i=>i.pc===0x8007&&i.mnemonic==='XCE'&&i.stateIn.carry===null),'PLP must mark carry unknown');
}
// Unknown PLP in emulation mode changes C even though E forces M/X=8.
{
 const {f}=analyze([0x38,0xf4,0x00,0x00,0x28,0xfb,0xa9,0x44,0xea,0xdb]);
 const cases=candidates(f,0x8006);
 assert(cases.some(x=>x.e&&x.m),'emulation may remain set');
 assert(cases.some(x=>!x.e&&x.m),'emulation may be cleared');
 assert(f.instructions.some(i=>i.pc===0x8005&&i.stateIn.carry===null));
}
// A *known* PHP/PLP round-trip restores carry exactly, no false fork.
{
 const {f}=analyze([0x18,0x08,0x38,0x28,0xfb,0xa9,0x44,0xea,0xdb]);
 const cases=candidates(f,0x8005);
 assert(cases.every(x=>!x.e),'known CLC/PHP must restore C=0 and enter native mode');
 assert(cases.some(x=>!x.e&&x.m));
}
// A conservative unknown-C state is distinct from true and false states and
// may not overwrite the preserved return-site provenance.
{
 const {f}=analyze([0x18,0xfb,0xf4,0x00,0x00,0x28,0xa9,0x44,0xea,0xdb]);
 assert(f.instructions.some(i=>i.pc===0x8006&&i.mnemonic==='LDA'&&i.stateIn.carry===null));
}
console.log('CFG_PLP_UNKNOWN_CARRY_V043687_PASS cases=4');
