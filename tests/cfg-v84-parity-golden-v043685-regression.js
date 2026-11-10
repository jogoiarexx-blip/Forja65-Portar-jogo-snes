'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const C=require('../forja65-core');
const golden=require('./reference/cfg-v043684-frontier-golden.json');
assert.equal(golden.cases,80);
for(let seed=0;seed<80;seed++){
 const d=C.makeSyntheticRom(),n=5+seed%40,target=n*2+6;
 for(let i=0;i<n;i++){d[2*i]=0xd0;d[2*i+1]=target-(2*i+2);}
 d[2*n]=0xea;d[target]=0xdb;
 const a=C.analyze(C.loadRom(d),1024);
 const graph={instructions:a.functions.flatMap(x=>x.instructions.map(i=>[i.pc,i.stateKey,i.mnemonic,i.size,i.returnSite===true])).sort((a,b)=>a[0]-b[0]),edges:a.functions.flatMap(x=>x.edges.map(e=>[e.from,e.to,e.type,e.fromState,e.toState])).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),issues:a.issues.map(x=>[x.kind,x.pc])};
 const digest=crypto.createHash('sha256').update(JSON.stringify(graph)).digest('hex');
 assert.equal(digest,golden.sha256[seed],`CFG diverged from v84 in reference case ${seed}`);
}
console.log('CFG_V84_PARITY_GOLDEN_V043685_PASS cases=80');
