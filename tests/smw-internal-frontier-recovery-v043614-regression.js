'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const C=require('../forja65-core.js');
const SMW=require('../crossfeed-historico/smw-monotonic/forja65-core.js');
const IO=require('../tools/project-io.js');
const M=require('../tools/migrate-smw-cfg-cache.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-internal-frontier-'));
const historical='0.4.29-monotonic-cfg-growth';
function setup(label){
 const rom=C.makeSyntheticRom();
 // BNE $8005; LDA #$01; RTS; LDX #$02; RTS. Both paths are ROM-backed.
 rom.set([0xD0,0x03,0xA9,0x01,0x60,0xA2,0x02,0x60],0);
 const romPath=path.join(root,label+'.sfc'),project=path.join(root,label);
 fs.writeFileSync(romPath,rom);
 IO.generate({romPath,out:project,max:3,cacheLimit:32});
 const old={...IO.makeCfgCache(SMW.analyze(SMW.loadRom(rom),5),C.romFingerprint(C.loadRom(rom))),version:historical};
 const cachePath=path.join(project,'analysis/cfg-coverage-cache.json');
 fs.writeFileSync(cachePath,JSON.stringify(old)+'\n');
 return {project,cachePath,old,romPath,rom};
}
try{
 const ok=setup('branch-budget');
 const noFocus=M.run({project:ok.project,apply:false});
 assert.equal(noFocus.status,'BLOCKED');
 assert.equal(noFocus.coverage.counts.states.missing,2);
 assert(noFocus.coverage.counts.edges.missing>0);
 const prior=fs.readFileSync(ok.cachePath);
 const main=fs.readFileSync(path.join(ok.project,'src/main.cpp'));
 const withFocus=M.run({project:ok.project,recoverInternalFrontiers:true,apply:false});
 assert.equal(withFocus.status,'READY',JSON.stringify(withFocus,null,2));
 assert.equal(withFocus.internal.passes.length,1);
 assert.equal(withFocus.internal.passes[0].beforeStates,2);
 assert.equal(withFocus.internal.passes[0].afterStates,0);
 assert(withFocus.coverage.complete);
 assert.deepEqual(fs.readFileSync(ok.cachePath),prior,'dry-run cannot alter original');
 assert.deepEqual(fs.readFileSync(path.join(ok.project,'src/main.cpp')),main);
 const cmd=cp.spawnSync(process.execPath,[path.join(__dirname,'../tools/forja65.js'),'migrate-smw-cfg',ok.project,'--recover-internal-frontiers'],{encoding:'utf8',timeout:30000});
 assert.equal(cmd.status,0,cmd.stderr);
 assert.equal(JSON.parse(cmd.stdout).status,'READY');
 const applied=M.run({project:ok.project,recoverInternalFrontiers:true,apply:true});
 assert.equal(applied.status,'APPLIED');
 const current=JSON.parse(fs.readFileSync(ok.cachePath));
 assert.equal(current.version,C.VERSION);
 assert(M.compareCoverage(ok.old,current).complete);
 assert.equal(current.functions.length,1,'frontiers must not create new synthetic functions');
 assert.deepEqual(fs.readFileSync(path.join(ok.project,'src/main.cpp')),main);
 assert(fs.existsSync(path.join(ok.project,'reports/cfg-cache-smw-migration.json')));
 // This flag does not automatically accept historical records missing in ROM.
 const tampered=setup('tampered-byte');
 const cache=JSON.parse(fs.readFileSync(tampered.cachePath));
 const targeted=cache.functions[0].instructions.find(i=>i.pc===0x8005);
 targeted.opcode=0xEA; // fake instruction at a real ROM address
 fs.writeFileSync(tampered.cachePath,JSON.stringify(cache));
 const blocked=M.run({project:tampered.project,recoverInternalFrontiers:true,apply:true});
 assert.equal(blocked.status,'BLOCKED');
 assert(blocked.internal.rejections.some(r=>r.reason.includes('differs from active decoder')));
 assert.equal(JSON.parse(fs.readFileSync(tampered.cachePath)).version,historical);
 // A fabricated internal address must never create a CFG entry or runtime edge.
 const fabricated=setup('fabricated');
 const fake=JSON.parse(fs.readFileSync(fabricated.cachePath));
 const original=fake.functions[0].instructions[0];
 fake.functions[0].instructions.push({...original,pc:0x7E0000,stateKey:'7E0000|111Q|S:'});
 fs.writeFileSync(fabricated.cachePath,JSON.stringify(fake));
 const noWram=M.run({project:fabricated.project,recoverInternalFrontiers:true,apply:true});
 assert.equal(noWram.status,'BLOCKED');
 assert(noWram.internal.rejections.some(r=>r.reason==='not a ROM address'));
 assert.equal(JSON.parse(fs.readFileSync(fabricated.cachePath)).version,historical);
 // An edited generated C++ source is a hard block even with full coverage.
 const edited=setup('source-edited');
 fs.appendFileSync(path.join(edited.project,'src/main.cpp'),'\n// LOCAL EDIT\n');
 const noOverwrite=M.run({project:edited.project,recoverInternalFrontiers:true,apply:true});
 assert.equal(noOverwrite.status,'BLOCKED');
 assert(noOverwrite.edited_sources.some(e=>e.includes('src/main.cpp')));
 console.log('SMW_INTERNAL_FRONTIER_RECOVERY_PASS blocked_default=1 ready=1 apply=1 guided_redecode=2 tampered=blocked wram=blocked custom_cpp=blocked');
}finally{fs.rmSync(root,{recursive:true,force:true});}
