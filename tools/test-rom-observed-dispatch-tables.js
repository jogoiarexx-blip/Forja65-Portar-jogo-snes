'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {discovery,makePack,apply}=require('./rom-observed-dispatch-tables');
const bytes=Buffer.alloc(0x80000,0);
bytes[0x71b]=0xdc;
const set=(at,a)=>{bytes[at]=a&255;bytes[at+1]=(a>>8)&255;bytes[at+2]=a>>16&255;};
[0x0589ce,0x058a9a,0x058a9b,0x0589ce].forEach((a,i)=>set(0x29000+3*i,a));
[0x058c70,0x058c71,0x058c70,0x058c71].forEach((a,i)=>set(0x2a000+3*i,a)); // decoy
const state={emulation:false,m8:true,x8:true,carry:false};
const hints=[{kind:'FLOW',from:0x871b,target:0x0589ce,state},{kind:'FLOW',from:0x871b,target:0x058d7a,state}];
const r=discovery(bytes,{source:0x871b,observations:hints});
assert.equal(r.runs.length,1);assert.equal(r.tableEntries,4);assert.deepEqual(r.entries.map(e=>e.address),[0x0589ce,0x058a9a,0x058a9b]);
assert.deepEqual(r.unmatchedObserved,[0x058d7a]);
assert.throws(()=>discovery(bytes,{source:0x871a,observations:hints}),/not JML/);
assert.throws(()=>discovery(bytes,{source:0x871b,observations:[{...hints[0],state:{...state,carry:true}},hints[1]]}),/Multiple observed CPU states/);
const pack=makePack('romhash',r),root=fs.mkdtempSync(path.join(os.tmpdir(),'forja-tables-'));
try{fs.mkdirSync(path.join(root,'analysis'));apply(root,pack);apply(root,pack);
 const x=JSON.parse(fs.readFileSync(path.join(root,'analysis/knowledge-pack.json'),'utf8'));
 assert.equal(x.entries.length,3);assert.equal(x.dispatch[0].targets.length,3);
 x.rom.fnv1a64='wrong';fs.writeFileSync(path.join(root,'analysis/knowledge-pack.json'),JSON.stringify(x));
 assert.throws(()=>apply(root,pack),/fingerprint mismatch/);
}finally{fs.rmSync(root,{force:true,recursive:true});}
console.log('rom-observed-dispatch-tables: PASS (ROM-bound, aligned, no false evidence, dedupe and safety)');
