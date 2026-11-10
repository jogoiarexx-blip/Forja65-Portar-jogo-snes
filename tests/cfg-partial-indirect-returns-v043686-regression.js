'use strict';
// The old returnStates() dropped the conservative caller state whenever even
// one of several indirect call targets had a known exit summary. That caused
// the native generator to omit an M/X-width variant at the JSR continuation.
const assert=require('node:assert/strict');
const C=require('../forja65-core');

function fixture({known=true,unknown=true,wideX=false,reverse=false,badRom=false}={}){
  const romBytes=C.makeSyntheticRom();
  // JSR ($8040,X); LDA #$EA44 (M=16) OR LDA #$44 ; NOP (M=8); STP
  romBytes.set([0xfc,0x40,0x80,0xa9,0x44,0xea,0xdb],0);
  // A known callee performs CLC; XCE; REP #$20 (native, 16-bit A); RTS.
  romBytes.set([0x18,0xfb,0xc2,wideX?0x30:0x20,0x60],0x60);
  // A second candidate loops forever. No exit summary can be produced.
  romBytes.set([0x80,0xfe],0x70);
  const rom=C.loadRom(romBytes),hash=C.romFingerprint(rom);
  let targets=[...(known?[0x8060]:[]),...(unknown?[0x8070]:[])];
  if(reverse)targets.reverse();
  const hints=targets.map(t=>({rom:badRom&&t===0x8070?'ffffffffffffffff':hash,target:t,from:0x8000,kind:'FLOW',state:{emulation:true,m8:true,x8:true,carry:null},observed:1}));
  const a=C.analyze(rom,4096,hints),fn=a.functions.find(f=>f.start===0x8000);
  assert(fn,'missing caller CFG');
  return {analysis:a,fn};
}
function widths(fn){return fn.instructions.filter(i=>i.pc===0x8003&&i.mnemonic==='LDA').map(i=>`${+i.stateIn.emulation}/${+i.stateIn.m8}/${+i.stateIn.x8}/${i.size}`).sort();}
const narrow='1/1/1/2',wide='0/0/1/3';
{
  const {fn}=fixture({unknown:false});
  assert.deepEqual(widths(fn),[wide,narrow].sort(),'single known returning callee cannot prove the dynamic table has no other target');
  assert(fn.frontierDiagnostics.openIndirectReturnDomains>=1);
  assert.equal(fn.frontierDiagnostics.partialReturnSummarySites,0);
}
{
  const {fn}=fixture({known:false});
  assert.deepEqual(widths(fn),[narrow],'unresolved-only indirect call must retain caller decode state');
}
{
  const {fn}=fixture();
  assert.deepEqual(widths(fn),[wide,narrow].sort(), 'partial summaries must keep BOTH continuation widths');
  assert(fn.frontierDiagnostics.partialReturnSummarySites>=1,'missing partial-summary diagnostic');
  assert(fn.frontierDiagnostics.unknownReturnTargetLookups>=1);
  assert(fn.instructions.some(i=>i.pc===0x8006&&i.mnemonic==='STP'));
  assert(fn.instructions.some(i=>i.pc===0x8005&&i.mnemonic==='NOP'));
  assert(fn.instructions.filter(i=>i.pc===0x8003).every(i=>i.returnSite),'return-site provenance lost');
}
{
  const {fn}=fixture({reverse:true});
  assert.deepEqual(widths(fn),[wide,narrow].sort(), 'observation order cannot suppress a caller state');
}
{
  const {fn,analysis}=fixture({badRom:true});
  assert.equal(analysis.runtimeHintsRejected,1);
  assert.deepEqual(widths(fn),[wide,narrow].sort(),'unrelated ROM observations excluded, unresolved dynamic domain remains conservative');
}
{
  const {fn}=fixture({wideX:true});
  assert.deepEqual(widths(fn),['0/0/0/3',narrow].sort(), 'mixed M/X width cannot be collapsed to one variant');
}
console.log('CFG_PARTIAL_INDIRECT_RETURNS_V043686_PASS scenarios=6 two-width-continuations=2 rom-bound-hints=yes');
