'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core');
function testRom({mode=0x6c,m8=false,tooWide=false}={}){
 const buf=F.makeSyntheticRom();
 // CPU $80:8100: RAM-indirect JMP $009E; never guess the RAM vector value.
 buf.set([mode,0x9e,0x00],0x100);
 for(let i=0;i<(tooWide?9:4);i++)buf.set([0xa9,0x1f-i*4,0x00,0x60],0x1f8+4*i);
 const rom=F.loadRom(buf,'rom-tiny-leaves.sfc');
 const hints=`rom=${F.romFingerprint(rom)} target=808200 from=808100 kind=FLOW e=0 m=${m8?1:0} x=0 c=0 observed=1`;
 const analysis=F.analyze(rom,128,F.parseRuntimeHints(hints));
 return {analysis,rom};
}
let {analysis}=testRom();
const peerIssues=analysis.issues.filter(i=>i.kind==='ROM-TINY-INDIRECT-CANDIDATE');
assert(peerIssues.length,'ROM-backed candidate should be documented');
for(const addr of [0x8081f8,0x8081fc,0x808204]){
 assert(analysis.functions.some(f=>f.start===addr),`ROM candidate ${addr.toString(16)} missing`);
 assert(!analysis.runtimeHints.some(h=>h.target===addr),'candidate cannot become a runtime observation');
}
assert.equal(analysis.runtimeHints.filter(h=>h.target===0x808200).length,1);
assert(!testRom({mode:0x7c}).analysis.issues.some(i=>i.kind==='ROM-TINY-INDIRECT-CANDIDATE'),'non-RAM-indirect JMP must not expand');
assert(!testRom({m8:true}).analysis.issues.some(i=>i.kind==='ROM-TINY-INDIRECT-CANDIDATE'),'8-bit accumulator cannot use four-byte leaf');
assert(!testRom({tooWide:true}).analysis.issues.some(i=>i.kind==='ROM-TINY-INDIRECT-CANDIDATE'),'family exceeding bounded size must not expand');
console.log('ROM_TINY_INDIRECT_LEAF_V0384_PASS candidates=3 observed=1 negative=3');
