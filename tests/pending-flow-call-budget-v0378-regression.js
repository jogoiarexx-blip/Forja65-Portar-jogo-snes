'use strict';
// Large plausible siblings must not spend the entire discovery budget before
// a direct dependency of the actually observed handler is visited.
const assert=require('node:assert/strict');
const C=require('../forja65-core');
function fixture(observedCalls=true){
 const bytes=C.makeSyntheticRom();bytes[0]=0xDB;
 bytes.set([0x7C,0,0x82],0x100);
 const targets=[0x8300,0x8400,0x8500,0x8600];
 targets.forEach((t,n)=>{bytes[0x200+2*n]=t&255;bytes[0x201+2*n]=t>>>8;});
 bytes.set(observedCalls?[0x20,0,0x90,0x60]:[0xDB],0x300);
 for(const t of targets.slice(1)){bytes.fill(0xEA,t-0x8000,t-0x8000+80);bytes[t-0x8000+80]=0x60;}
 bytes.set([0xE6,0x00,0x60],0x1000);
 return C.loadRom(bytes,'peer-call-budget.sfc');
}
const hints=C.parseRuntimeHints('target=008300 from=008100 kind=FLOW e=1 m=1 x=1 c=0');
const a=C.analyze(fixture(),128,hints);
assert.equal(a.functions[0].entryName,'RESET');
assert(a.functions.some(f=>f.start===0x8400),'a real ROM-backed peer still gets discovery work');
assert(a.functions.some(f=>f.start===0x9000),'direct dependency of observed handler must not starve behind large predicted peers');
assert(a.functions.findIndex(f=>f.start===0x8300)<a.functions.findIndex(f=>f.start===0x8400),'observation remains ahead of prediction');
assert(a.functions.reduce((n,f)=>n+f.instructions.length,0)<=128,'global discovery cap is preserved');
assert(!a.functions.some(f=>f.start===0xEAEA),'repeated filler guard remains active');
// Reserved call capacity is reusable once no competing work remains.
const peersOnly=C.analyze(fixture(false),128,hints);
assert.equal(peersOnly.functions.reduce((n,f)=>n+f.instructions.length,0),128,'unused reservation must not throw away available discovery budget');
console.log('PENDING_FLOW_CALL_BUDGET_V0378=PASS');
// A cheap actual dependency releases its reservation to a single long peer.
function singlePeer(descendant=false){
 const bytes=C.makeSyntheticRom();bytes[0]=0xDB;
 bytes.set([0x7C,0,0x82],0x100);bytes.set([0,0x83,0,0x84],0x200);
 bytes.set([0x20,0,0x90,0x60],0x300);bytes[0x1000]=0x60;
 bytes.fill(0xEA,0x400,0x400+100);bytes[0x400+100]=0x60;
 if(descendant){bytes.set([0x20,0,0xA0],0x400);bytes[0x40A]=0x60;bytes.fill(0xEA,0x2000,0x2300);bytes[0x2300]=0x60;}
 return C.loadRom(bytes,'single-peer.sfc');
}
const reused=C.analyze(singlePeer(),128,hints);
assert.equal(reused.functions.find(f=>f.start===0x8400).instructions.length,101,'a deferred peer completes once cheap actual work releases capacity');
assert(!reused.issues.some(i=>i.kind==='CFG-LIMIT'&&i.pc===0x8400),'no premature function truncation with sufficient global capacity');
const descendants=C.analyze(singlePeer(true),128,hints);
assert(descendants.functions.some(f=>f.start===0x9000),'speculative peer descendants must not starve the observed dependency');
assert(descendants.functions.findIndex(f=>f.start===0x8400)<descendants.functions.findIndex(f=>f.start===0x9000),'small peer is visited before the actual dependency, exercising inherited provenance');
assert(descendants.functions.reduce((n,f)=>n+f.instructions.length,0)<=128);
console.log('PENDING_FLOW_CALL_BUDGET_REVIEW=PASS');
