'use strict';const assert=require('node:assert/strict'),{readRanges}=require('./rom-word-table-seeds');
const b=Buffer.alloc(0x20000);const a=[0x8172,0x8575,0x8172];a.forEach((n,i)=>{b[0x8000+2*i]=n&255;b[0x8001+2*i]=n>>8;});
const r=readRanges(b,[{start:0x8000,end:0x8006,bank:1}]);
assert.equal(r.entries.length,2);assert.deepEqual(r.entries.find(x=>x.address===0x018172).offsets,[0x8000,0x8004]);
assert.throws(()=>readRanges(b,[{start:0x8000,end:0x8008,bank:1}]));
assert.throws(()=>readRanges(b,[{start:0x8000,end:0x8007,bank:1}]));
console.log('rom-word-table-seeds: PASS');
