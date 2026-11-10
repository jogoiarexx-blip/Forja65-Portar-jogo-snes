'use strict';
const assert=require('node:assert/strict');
const {inspect,parse}=require('../tools/rom-callback-seeds');
const bytes=Buffer.alloc(0x10000,0);const base=0x8000;
bytes.set([0xa9,0x00,0xc0,0x95,0x02],base+0x0100);
bytes.set([0xa9,0x00,0xc0,0x95,0x02],base+0x0200);
bytes.set([0xa9,0x50,0xc0,0x95,0x02],base+0x0300);
bytes.set([0xa9,0x40,0x00,0x95,0x02],base+0x0400); // RAM target rejected
bytes.set([0xa9,0x01,0xc0,0x95,0x03],base+0x0500); // different offset rejected
const result=inspect(bytes,0x81,2,new Set([0x81c000]));
assert.equal(result.total,2);assert.equal(result.records[0].address,0x81c000);assert.deepEqual(result.records[0].source_pcs,[0x818100,0x818200]);assert.equal(result.records[1].address,0x81c050);
assert.equal(inspect(bytes,0x81,2,new Set(),1).truncated,true);
assert.equal(inspect(bytes,0x81,3,new Set()).total,1);
assert.throws(()=>inspect(bytes,0x82,2),/not present/);
assert.throws(()=>parse(['--project','.', '--bank','GZ']),/Invalid hex/);
console.log('rom-callback-seeds-v05-regression: OK');
