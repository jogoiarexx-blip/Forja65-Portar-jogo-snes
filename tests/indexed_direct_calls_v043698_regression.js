#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {directCalls}=require('../tools/indexed-direct-calls.js');
const rom={data:Uint8Array.from([0x20,0x32,0xA5,0x22,0x00,0xE0,0xB9])};
const map=(rom,pc)=>pc===0xB8A458?0:pc===0xB8A473?3:null;
const source='// $B8A458 JSR -> $B8A532 stack real\n// $B8A458 JSR -> $B8A532 stack real\n// $B8A473 JSL -> $B9E000 stack real';
const links=directCalls(source,rom,map);
assert.equal(links.length,2);assert.equal(links[0].target,'B8A532');assert.equal(links[1].target,'B9E000');
assert.equal(links[0].proof,'ROM_LITERAL_CALL_NOT_EXECUTED');
assert.throws(()=>directCalls(source.replace('B8A532','B8A533'),rom,map),/differs/);
assert.throws(()=>directCalls(source.replace('JSR','JSL'),rom,map),/differs/);
assert.throws(()=>directCalls('// $B8A999 JSR -> $B8A532 stack real',rom,map),/Unmapped/);
console.log('FORJA65_DIRECT_CALLS_V043698_PASS unique=2 mismatched_rejected=3');
