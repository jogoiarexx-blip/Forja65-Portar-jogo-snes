'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const C=require('../forja65-core'),R=require('./runtime-evidence-vault'),A=require('./recovery-advisor'),G=require('./regression-intelligence');
const base=fs.mkdtempSync(path.join(os.tmpdir(),'forja-advisor-')),home=path.join(base,'knowledge');
const proj=path.join(base,'one'),other=path.join(base,'same-rom'),alien=path.join(base,'different-rom');
const put=(f,s)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
function make(root,rom){put(path.join(root,'assets/cart-data.bin'),rom);put(path.join(root,'src/engine.cpp'),'// engine\n');
 const bin=path.join(root,'game');put(bin,"#!/usr/bin/env node\nconst fs=require('fs');const a=process.argv;const frames=Number(a[3]);fs.writeFileSync('forja65-qa-status.txt','runtime_started=OK\\nframes='+frames+'\\n');if(a[2]==='fail'){fs.writeFileSync('forja65-crash-trace.txt', 'PC=$C0A123\\nREASON=unresolved indexed JMP\\nframe='+frames+'\\n2026-10-16T21:11:10Z\\n');process.exit(12)}process.exit(0);\n");fs.chmodSync(bin,0o755);
}
try{
 const rom=Buffer.from(C.makeSyntheticRom());make(proj,rom);make(other,rom);const changed=Buffer.from(rom);changed[0x2200]^=1;make(alien,changed);
 const run=R.open(proj,{home}),adv=A.open(proj,{home}),guard=G.open(proj,{home});
 assert.equal(adv.report().openIssues,0,'empty history should not fabricate advice');
 const first=run.run({exec:'game',argv:['pass','120'],minFrames:120,checkpoint:'boot'});
 assert.equal(first.status,'checkpoint-passed');guard.freeze({checkpoint:'boot'});
 const f1=run.run({exec:'game',argv:['fail','100'],minFrames:120,checkpoint:'boot'});
 const f2=run.run({exec:'game',argv:['fail','101'],minFrames:120,checkpoint:'boot'});
 assert.equal(f1.failureSignature,f2.failureSignature);
 const rep=adv.report(),item=rep.issues[0];
 assert.equal(rep.openIssues,1);assert.equal(item.occurrences,2);assert.equal(item.pc,'$C0A123');
 assert.equal(item.baselineStatus,'regression');assert.ok(item.actions.some(x=>x.domain==='cfg-control-flow'));
 assert.equal(item.cfg.cfgSource,'not-present');assert.equal(rep.nativeRuns,3);
 const saved=adv.save(),saved2=adv.save();assert.equal(saved.saved,true);assert.equal(saved2.saved,false);
 assert.ok(fs.existsSync(saved.path));assert.equal(A.open(other,{home}).report().openIssues,1);
 assert.equal(A.open(alien,{home}).report().openIssues,0,'ROM isolation');
 const pass=run.run({exec:'game',argv:['pass','130'],minFrames:120,checkpoint:'boot'});
 assert.equal(pass.status,'checkpoint-passed');assert.equal(adv.report().openIssues,0);
 const closed=adv.report({includeClosed:true});assert.equal(closed.issues[0].state,'passed-after-failure');
 assert.equal(closed.issues[0].baselineStatus,'protected');
 // Failure reopens after success, but earlier evidence is retained.
 const newFail=run.run({exec:'game',argv:['fail','104'],minFrames:120,checkpoint:'boot'});
 assert.equal(newFail.status,'failed');assert.equal(adv.report().openIssues,1);assert.equal(adv.report().issues[0].trend,'reopened');
 assert.equal(A.address('C0:A123'),0xC0A123);assert.equal(A.address('garbage'),null);
 // Stale static CFG must not be used to claim validated coverage.
 put(path.join(proj,'analysis/cfg-coverage-cache.json'),JSON.stringify({schema:'forja65.cfg-coverage-cache.v1',rom:run.vault.id.fnv1a64,version:'unsupported',functions:[{start:0xC0A123}]}));
 const legacy=adv.report().issues[0];assert.equal(legacy.cfg.cfgSource,'project-legacy-unverified');assert.equal(legacy.cfg.decodedInCfg,undefined);
 assert.ok(legacy.actions.some(x=>x.domain==='cfg-revalidation'));
 console.log('PASS: 15 recovery-advisor assertions groups: classification, PC, ranking, baseline, saves, cross-folder, ROM isolation, CFG gate, reopening');
}catch(e){console.error(e);process.exitCode=1;}finally{fs.rmSync(base,{recursive:true,force:true});}
