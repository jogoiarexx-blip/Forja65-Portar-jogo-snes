'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core.js');
const {partitionExecutableHints}=require('../tools/rom-executable-hints.js');
const rom={header:{mapping:C.MAP.LOROM},data:new Uint8Array(2*1024*1024)};
const hints=[
  {target:0x82FA38,kind:'FLOW'},
  {target:0x82F9C4,kind:'FLOW'},
  {target:0x00003E,kind:'FLOW'},
  {target:0x7E2000,kind:'FLOW'},
  {target:0x002100,kind:'FLOW'},
];
const result=partitionExecutableHints(rom,hints);
assert.deepEqual(result.romHints.map(h=>h.target),[0x82FA38,0x82F9C4]);
assert.deepEqual(result.nonRomHints.map(h=>h.target),[0x00003E,0x7E2000,0x002100]);
console.log('PASS: ROM targets retained, executable WRAM/IO targets rejected from CFG hints');
