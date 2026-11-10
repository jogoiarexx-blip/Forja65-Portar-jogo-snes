'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const C=require('../forja65-core'),Vault=require('../tools/knowledge-vault'),Runtime=require('../tools/runtime-evidence-vault'),Repairs=require('../tools/cpp-corrections-vault');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-runtime-v114-')),home=path.join(tmp,'knowledge');
const rom=Buffer.from(C.makeSyntheticRom());
function port(name,bytes=rom){const p=path.join(tmp,name);fs.mkdirSync(path.join(p,'assets'),{recursive:true});fs.mkdirSync(path.join(p,'src'),{recursive:true});fs.writeFileSync(path.join(p,'assets','cart-data.bin'),bytes);return p;}
function fakeExe(root){const f=path.join(root,'game');fs.writeFileSync(f,`#!/usr/bin/env node
const fs=require('fs');
if(process.argv.includes('fail')){fs.writeFileSync('forja65-last-error.txt','Unhandled jump at BE0001\\n');process.exit(8)}
if(process.argv.includes('noqa')){process.exit(0)}
fs.writeFileSync('forja65-qa-status.txt','FORJA65_QA 1\\nruntime_started=PASS\\nframes='+process.env.FORJA65_HEADLESS_FRAMES+'\\n');
if(process.argv.includes('crash'))fs.writeFileSync('forja65-crash-trace.txt','Crash after frame 100\\n');
console.log('RUN END');
`);fs.chmodSync(f,0o755);return f;}
try{
 const base=port('base'),target=port('target'),wrong=Buffer.from(rom);wrong[20]^=32;const other=port('other-rom',wrong),exe=fakeExe(target);
 fs.writeFileSync(path.join(base,'src','fix.cpp'),'int fix=0;\n');fs.writeFileSync(path.join(target,'src','fix.cpp'),'int fix=1;\n');
 const proof=path.join(tmp,'proof.txt');fs.writeFileSync(proof,'synthetic approved test');
 const repairs=Repairs.open(target,{home});assert.equal(repairs.capture({baseline:base,evidence:proof,verified:true}).revision,1);
 const R=Runtime.open(target,{home});
 const hash=C.romFingerprint(C.loadRom(rom,'test.sfc'));
 fs.writeFileSync(path.join(target,'forja65-runtime-hints.txt'),`rom=${hash} target=008001 kind=JSR e=1 m=1 x=1 c=? observed=2\n`);
 const legacy=R.importExisting({checkpoint:'hints-legacy'});assert.equal(legacy.status,'historical-unverified');
 assert.equal(C.parseRuntimeHints(Vault.instance(C.loadRom(rom,'test.sfc'),rom,{home}).load().hints).length,1);
 const fail=R.run({exec:exe,argv:['fail'],checkpoint:'stage1',minFrames:100,frames:120});assert.equal(fail.status,'failed');assert.equal(fail.exitCode,8);assert.equal(fail.artifacts.some(x=>x.path==='forja65-last-error.txt'),true);
 // Leaving the old error file intact must not be treated as a new failure.
 const ok=R.run({exec:exe,checkpoint:'stage1',minFrames:120,frames:120});assert.equal(ok.status,'checkpoint-passed');assert.equal(ok.frames,120);assert.equal(ok.artifacts.some(x=>x.path==='forja65-last-error.txt'),false);assert.equal(ok.repairCheckpointMatches.length,1);assert.deepEqual(ok.repairCheckpointMatches[0].priorFailures,[fail.id]);
 assert.equal(R.report().unresolved.length,0);assert.equal(R.report().total,3);
 const repeat=R.run({exec:exe,checkpoint:'stage1',minFrames:120,frames:120});assert.equal(repeat.status,'checkpoint-passed','rewritten QA with same bytes must count as fresh');
 const nope=R.run({exec:exe,argv:['noqa'],checkpoint:'stage2',minFrames:120});assert.equal(nope.status,'checkpoint-not-reached');
 const crash=R.run({exec:exe,argv:['crash'],checkpoint:'stage3',minFrames:120});assert.equal(crash.status,'failed');
 assert.equal(R.report().unresolved.length,2);
 const imported=R.importExisting({checkpoint:'archival'});assert.equal(imported.status,'historical-unverified');assert.equal(R.report().total,7);
 const again=Runtime.open(port('fresh-same-rom'),{home});assert.equal(again.report().total,7);
 assert.equal(Runtime.open(other,{home}).report().total,0);
 assert.equal(again.index().events[0].artifacts.some(x=>x.sha256.length===64),true);
 console.log('runtime-evidence-v0436114: PASS (real subprocess, stale log isolation, crash evidence, checkpoints, repair links, cross-project ROM memory, ROM isolation, historical import)');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
