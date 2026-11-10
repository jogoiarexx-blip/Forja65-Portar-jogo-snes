'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const C=require('../forja65-core'),R=require('./runtime-evidence-vault'),G=require('./regression-intelligence'),Repairs=require('./cpp-corrections-vault');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-regression-test-')),home=path.join(tmp,'vault'),project=path.join(tmp,'game-one'),other=path.join(tmp,'game-two'),older=path.join(tmp,'before'),foreign=path.join(tmp,'other-rom');
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);}
function copy(dst,rom){write(path.join(dst,'assets/cart-data.bin'),rom);write(path.join(dst,'src/engine.cpp'),'// original code\n');}
function runner(dst){const file=path.join(dst,'game');write(file,`#!/usr/bin/env node\nconst fs=require('fs'); const mode=process.argv[2]||'pass',frames=Number(process.argv[3]||120);fs.writeFileSync('forja65-qa-status.txt','runtime_started=OK\\nframes='+frames+'\\n');if(mode==='bad-a'){fs.writeFileSync('forja65-crash-trace.txt','PC=$C0A123\\nREASON=unknown jump\\nframe='+frames+'\\n2026-10-16T21:11:10Z\\n');process.exit(19)}if(mode==='bad-b'){fs.writeFileSync('forja65-crash-trace.txt','PC=$C0B999\\nREASON=invalid opcode\\nframe='+frames+'\\n2026-10-16T21:11:11Z\\n');process.exit(22)}process.exit(0);`);fs.chmodSync(file,0o755);}
try{
 const rom=Buffer.from(C.makeSyntheticRom());copy(project,rom);copy(other,rom);copy(older,rom);runner(project);runner(other);
 const run=R.open(project,{home}),guard=G.open(project,{home});
 const e1=run.run({exec:'game',argv:['pass','120'],minFrames:120,checkpoint:'boot'});
 assert.equal(e1.status,'checkpoint-passed');assert.ok(e1.sourceDigest);assert.equal(guard.check({checkpoint:'boot'}).details[0].status,'no-baseline');
 assert.equal(guard.freeze({checkpoint:'boot'}).baseline.frames,120);
 assert.throws(()=>guard.freeze({checkpoint:'boot'}),/already exists/);
 const binary=fs.readFileSync(path.join(project,'game'));fs.appendFileSync(path.join(project,'game'),'\n// updated executable');
 assert.equal(guard.check({checkpoint:'boot'}).details[0].status,'inconclusive','binary replaced after test must be reverified');
 fs.writeFileSync(path.join(project,'game'),binary);fs.chmodSync(path.join(project,'game'),0o755);
 const e2=run.run({exec:'game',argv:['pass','150'],minFrames:120,checkpoint:'boot'});
 assert.equal(guard.check({checkpoint:'boot'}).details[0].status,'protected');
 const e3=run.run({exec:'game',argv:['bad-a','115'],minFrames:120,checkpoint:'boot'});
 assert.equal(guard.check({checkpoint:'boot'}).details[0].status,'regression');
 const e4=run.run({exec:'game',argv:['bad-a','117'],minFrames:120,checkpoint:'boot'});
 assert.equal(e3.failureSignature,e4.failureSignature,'volatile frames/date must not alter failure signature');
 assert.equal(guard.compare(e3,e4).trend,'recurring-failure');
 const e5=run.run({exec:'game',argv:['bad-b','117'],minFrames:120,checkpoint:'boot'});
 assert.notEqual(e5.failureSignature,e4.failureSignature);assert.equal(guard.compare(e4,e5).trend,'new-failure');
 const e6=run.run({exec:'game',argv:['pass','125'],minFrames:120,checkpoint:'boot'});
 assert.equal(guard.check({checkpoint:'boot'}).details[0].status,'protected');
 assert.equal(guard.compare(e5,e6).trend,'checkpoint-recovered');
 const e7=run.run({exec:'game',argv:['bad-a','110'],minFrames:120,checkpoint:'boot'});
 assert.equal(guard.compare(e6,e7).trend,'reopened-failure');
 const e8=run.run({exec:'game',argv:['pass','110'],minFrames:100,checkpoint:'boot'});
 assert.equal(e8.status,'checkpoint-passed');assert.ok(guard.check({checkpoint:'boot'}).details[0].reasons.some(x=>x.includes('Coverage fell')));
 assert.throws(()=>guard.freeze({checkpoint:'boot',replace:true}),/lower/);
 const e9=run.run({exec:'game',argv:['pass','130'],minFrames:120,checkpoint:'boot'});
 assert.equal(guard.check({checkpoint:'boot'}).details[0].status,'protected');
 // Second folder on same ROM retrieves same history and baseline.
 const otherGuard=G.open(other,{home});assert.equal(otherGuard.index().baselines.boot.eventId,e1.id);assert.equal(otherGuard.openRuntime.index().events.length,9);
 // Approved repair must remain present in exact source bytes; regress otherwise.
 write(path.join(project,'src/engine.cpp'),'// fix for PC C0A123\n');write(path.join(tmp,'proof.log'),'native test evidence explicitly verified\n');
 Repairs.open(project,{home}).capture({baseline:older,evidence:path.join(tmp,'proof.log'),verified:true});
 const e10=run.run({exec:'game',argv:['pass','140'],minFrames:120,checkpoint:'boot'});
 assert.equal(e10.repairCheckpointMatches.length,1);
 guard.freeze({checkpoint:'boot',replace:true});
 assert.equal(guard.check({checkpoint:'boot'}).details[0].status,'baseline-current');
 write(path.join(project,'src/engine.cpp'),'// fix removed!\n');
 const lost=guard.check({checkpoint:'boot'}).details[0];assert.equal(lost.status,'regression');assert.deepEqual(lost.repairsLost,['src/engine.cpp']);
 // Altered cartridge cannot access previous baseline, even with same vault home.
 const alien=Buffer.from(rom);alien[0x2000]^=1;copy(foreign,alien);runner(foreign);
 assert.equal(G.open(foreign,{home}).index().baselines.boot,undefined);
 // Corrupted ROM identity in saved baseline must be rejected.
 const srcIndex=guard.file;const invalid=JSON.parse(fs.readFileSync(srcIndex));invalid.rom.sha256='0'.repeat(64);fs.writeFileSync(srcIndex,JSON.stringify(invalid));assert.throws(()=>guard.check(),/another ROM/);
 console.log('PASS: 13 sets of assertions; total native runs:',run.index().events.length);
 console.log('PASS: baseline, protected, dropped coverage, recurring/new/reopened crash, repair loss, new folder, isolated ROM');
}catch(e){console.error(e);process.exitCode=1;}finally{fs.rmSync(tmp,{recursive:true,force:true});}
