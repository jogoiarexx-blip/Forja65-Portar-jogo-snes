'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core');
function chain(depth,opts={}){
  const d=C.makeSyntheticRom();
  for(let k=0;k<depth;k++){
    const n=(k+1)*0x20;
    d.set([0x20,n&255,0x80+(n>>>8),...(k===0?[0xa9,0x44,0xea,0xdb]:[0x60])],k*0x20);
  }
  // Deep callee switches from emulation to native, widens accumulator to 16 bits.
  d.set([0x18,0xfb,0xc2,0x20,0x60],depth*0x20);
  const analysis=C.analyze(C.loadRom(d),1024,[],opts);
  const root=analysis.functions.find(f=>f.start===0x8000);
  assert(root);
  const decodes=root.instructions.filter(i=>i.pc===0x8003&&i.mnemonic==='LDA');
  return {analysis,decodes};
}
function wide(name,depth){const {analysis,decodes}=chain(depth);assert(analysis.summaryConverged,name+' did not converge');assert(decodes.some(i=>i.size===3&&!i.stateIn.emulation&&!i.stateIn.m8),name+': lost 16-bit return state');assert(!decodes.some(i=>i.size===2),name+': stale 8-bit return state');assert(!analysis.issues.some(i=>i.kind==='CFG-SUMMARY-LIMIT'));}
wide('eight-call reference',8);
wide('previously broken ninth call',9);
wide('long 12-call chain',12);
wide('long 20-call chain',20);
{
 const {analysis,decodes}=chain(9,{summaryRounds:8});
 assert.equal(analysis.summaryConverged,false,'explicit limited analysis must admit nonconvergence');
 assert(analysis.issues.some(i=>i.kind==='CFG-SUMMARY-LIMIT'));
 assert.equal(analysis.status,'PORT_AINDA_NAO_JOGAVEL');
 assert(decodes.some(i=>i.size===2),'limited analysis should reproduce original failure');
}
{
 const {analysis}=chain(36);
 assert.equal(analysis.summaryConverged,false,'default safety cap must not fake convergence');
 assert.equal(analysis.summaryRoundLimit,32);
 assert(analysis.issues.some(i=>i.kind==='CFG-SUMMARY-LIMIT'));
 assert.equal(analysis.status,'PORT_AINDA_NAO_JOGAVEL');
}
console.log('CFG_CALL_SUMMARY_CONVERGENCE_V043687_PASS cases=6 adaptive_depths=8,9,12,20 flagged_caps=2');
