#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {completeReplay}=require('../tools/input-differential-probe.js');
const frames=Array.from({length:4},(_,i)=>({frame:i,framebuffer:'aa',wram:'bb'}));
const full={exit_code:0,error:null,frames};
assert.equal(completeReplay(full,4),true);
assert.equal(completeReplay({...full,exit_code:2},4),false);
assert.equal(completeReplay({...full,error:'timed out'},4),false);
assert.equal(completeReplay({...full,frames:frames.slice(0,3)},4),false);
assert.equal(completeReplay({...full,frames:[...frames.slice(0,2),frames[1],frames[3]]},4),false);
assert.equal(completeReplay({...full,frames:[...frames.slice(0,2),{...frames[2],frame:4},frames[3]]},4),false);
assert.equal(completeReplay(full,5),false);
console.log('PASS input-differential completeness v0.10 regression (7 cases)');
