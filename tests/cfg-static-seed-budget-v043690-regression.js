'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const bytes=F.makeSyntheticRom();
// Known direct-call chain from RESET competes for the same global decode quota.
bytes.set([0x20,0x20,0x80,0x60],0);
bytes.set([0x20,0x40,0x80,0x60],0x20);
bytes.set([0xe8,0x60],0x40);
bytes[0x100]=0x60; // ROM-backed extra static target at $808100
const rom=F.loadRom(bytes,'static-seed-priority.sfc');
const pack={schema:'forja65.knowledge.v1',rom:{fnv1a64:F.romFingerprint(rom)},entries:[
  {address:0x808100,name:'static_call_808100',category:'UNKNOWN',
   state:{emulation:false,m8:false,x8:false,carry:null},source:'static-test',
   evidence:['static-only']}
 ],dataRegions:[],dispatch:[]};
const tight=F.analyze(rom,4,[],{knowledge:pack,summaryRounds:0});
assert.equal(tight.functions[0].start,0x8000,'RESET must retain first place');
assert(tight.functions.some(f=>f.start===0x808100),'static call seed must not starve behind reset callees');
assert(tight.knowledgeSeedsImported===1,'knowledge seed not registered');
const otherPack=JSON.parse(JSON.stringify(pack));otherPack.entries[0].name='unrelated_808100';
const less=F.analyze(rom,4,[],{knowledge:otherPack,summaryRounds:0});
assert(!less.functions.some(f=>f.start===0x808100),'ordinary knowledge seeds must keep normal queue priority');
console.log('CFG_STATIC_SEED_BUDGET_PASS');
