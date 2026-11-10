'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core');
const data=F.makeSyntheticRom();
data[0]=0x7C;data[1]=0;data[2]=0x81; // RESET: JMP ($8100,X)
const targets=[];
for(let i=0;i<5;i++){
  const t=0x8200+i*16;targets.push(t);
  data[0x100+i*2]=t&255;data[0x101+i*2]=t>>8;
  data[t-0x8000]=0xEA;data[t-0x8000+1]=0x60;
}
const rom=F.loadRom(data,'flow-table-priority.sfc');
const h='target=808210 from=808000 kind=FLOW e=1 m=1 x=1 c=0';
const a=F.analyze(rom,12,h);
assert.equal(a.functions[0].start,0x8000,'RESET must retain first priority');
assert(a.functions.some(f=>f.start===0x808210),'observed target must be compiled');
for(const t of targets)assert(a.functions.some(f=>f.start===(0x800000|t)),
 'a genuine contiguous peer must be visited before speculative vector states');
assert(!a.functions.some(f=>f.start===0x80EAEA),'NOP filler cannot become a speculative entry');
assert(a.issues.some(i=>i.kind==='ORACLE-FLOW-TABLE'),'expansion must remain auditable');
console.log('FLOW_TABLE_PRIORITY_V0375_PASS: RESET, observed target, 5 peers, no repeated filler');
