'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const C=require('../forja65-core');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-learn-transaction-'));
try {
 const rom=path.join(tmp,'sample.sfc'),project=path.join(tmp,'port'),diag=path.join(tmp,'diag');
 fs.writeFileSync(rom,Buffer.from(C.makeSyntheticRom()));fs.mkdirSync(diag);
 const cli=path.join(__dirname,'../tools/forja65.js');
 let r=cp.spawnSync(process.execPath,[cli,'analyze',rom,'--out',project,'--max','512'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr||r.stdout);
 const hintsPath=path.join(project,'analysis/runtime-hints.txt');
 const before=fs.readFileSync(hintsPath);
 const loaded=C.loadRom(new Uint8Array(fs.readFileSync(rom)),'sample.sfc');
 const entry=C.resetAddress(loaded);
 fs.writeFileSync(path.join(diag,'forja65-runtime-hints.txt'),`rom=${C.romFingerprint(loaded)} target=${C.hex(entry,6)} from=${C.hex(entry,6)} kind=FLOW e=1 m=1 x=1 c=0\n`);
 // A poisoned cache must be refused, leaving the previously verified hints unchanged.
 const cache=path.join(project,'analysis/cfg-coverage-cache.json');
 const backup=fs.readFileSync(cache);const tampered=JSON.parse(backup);
 tampered.rom='wrong-rom';fs.writeFileSync(cache,JSON.stringify(tampered));
 r=cp.spawnSync(process.execPath,[cli,'learn-crash',project,'--from',diag,'--max','512'],{encoding:'utf8'});
 assert.notEqual(r.status,0,'tampered cache must be refused');
 assert.match(r.stderr,/cache incompatible|different ROM/i);
 assert.deepEqual(fs.readFileSync(hintsPath),before,'learning failure changed permanent hints');
 fs.writeFileSync(cache,backup);
 // Simulate a generator that has already replaced the hints before failing.
 // The CLI catch path must restore the old verified bytes, not just prevalidate.
 const preload=path.join(tmp,'inject-write-failure.js');
 fs.writeFileSync(preload,`const fs=require('fs'),path=require('path');\nconst io=require(${JSON.stringify(path.join(__dirname,'../tools/project-io.js'))});\nio.generate=({out})=>{fs.writeFileSync(path.join(out,'analysis/runtime-hints.txt'),'corrupted-after-write');throw new Error('INJECTED_WRITE_FAILURE');};\n`);
 r=cp.spawnSync(process.execPath,['--require',preload,cli,'learn-crash',project,'--from',diag,'--max','512'],{encoding:'utf8'});
 assert.notEqual(r.status,0,'injected post-write failure must fail');
 assert.match(r.stderr,/INJECTED_WRITE_FAILURE/);
 assert.deepEqual(fs.readFileSync(hintsPath),before,'post-write generator failure left corrupt hints');
 console.log('TRANSACTIONAL_CRASH_LEARNING_V0383_PASS');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
