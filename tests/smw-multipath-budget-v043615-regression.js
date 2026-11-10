'use strict';
// Deterministic ROM-only fixtures. Verifies bounded multi-frontier recovery,
// opt-in higher budgets, immutable dry-runs and fail-closed mismatches.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const C=require('../forja65-core.js');
const SMW=require('../crossfeed-historico/smw-monotonic/forja65-core.js');
const IO=require('../tools/project-io.js');
const M=require('../tools/migrate-smw-cfg-cache.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-multipath-budget-'));
function setup(label,cacheLimit=512){
 const rom=C.makeSyntheticRom();
 // Ten independently reachable branch paths within ONE function. A small
 // budget runs down the fallthroughs and defers the other targets.
 for(let j=0;j<10;j++){
  rom[j*2]=0xD0;
  rom[j*2+1]=0x40+j*3-(j*2+2);
 }
 rom[20]=0x60;
 for(let j=0;j<10;j++){
  rom[0x40+j*3]=0xA9;rom[0x41+j*3]=j+1;rom[0x42+j*3]=0x60;
 }
 const romPath=path.join(tmp,label+'.sfc'),project=path.join(tmp,label);
 fs.writeFileSync(romPath,rom);
 IO.generate({romPath,out:project,max:12,cacheLimit});
 const old={...IO.makeCfgCache(SMW.analyze(SMW.loadRom(rom),64),C.romFingerprint(C.loadRom(rom))),
  version:'0.4.29-monotonic-cfg-growth'};
 assert.equal(old.functions.length,1);
 assert.equal(old.functions[0].instructions.length,31);
 const cachePath=path.join(project,'analysis/cfg-coverage-cache.json');
 fs.writeFileSync(cachePath,JSON.stringify(old)+'\n');
 return {project,cachePath,old,romPath};
}
try{
 const many=setup('many');
 const oldCache=fs.readFileSync(many.cachePath),sourceFile=path.join(many.project,'src/main.cpp');
 const source=fs.readFileSync(sourceFile);
 const legacyLimit=M.run({project:many.project,apply:false,recoverInternalFrontiers:true,internalPassLimit:6});
 assert.equal(legacyLimit.status,'BLOCKED');
 assert.equal(legacyLimit.internal.passes.length,6);
 assert.equal(legacyLimit.coverage.counts.states.missing,7);
 const morePasses=M.run({project:many.project,apply:false,recoverInternalFrontiers:true});
 assert.equal(morePasses.status,'BLOCKED');
 assert(morePasses.internal.passes.length>6);
 assert.equal(morePasses.coverage.counts.states.missing,1);
 assert.equal(morePasses.internal.passLimit,24);
 assert(morePasses.internal.passes.every(p=>p.acceptedBudget<=12&&p.evidenceGained>=0));
 assert.equal(morePasses.escalation.enabled,false);
 const budget=M.run({project:many.project,apply:false,recoverInternalFrontiers:true,budgetCeiling:32});
 assert.equal(budget.status,'READY',JSON.stringify(budget));
 assert(budget.internal.passes.length>6);
 assert.equal(budget.coverage.counts.states.missing,0);
 assert.equal(budget.coverage.complete,true);
 assert.equal(budget.escalation.stopReason,'coverage complete');
 assert.deepEqual(budget.escalation.steps.map(s=>s.requested),[24]);
 assert(budget.escalation.steps.every(s=>s.accepted<=s.requested));
 assert.equal(budget.effectiveMax,24);
 assert.deepEqual(fs.readFileSync(many.cachePath),oldCache,'dry-run touched old cache');
 assert.deepEqual(fs.readFileSync(sourceFile),source,'dry-run touched executable sources');
 const insufficient=M.run({project:many.project,apply:false,recoverInternalFrontiers:true,
  internalPassLimit:6,budgetCeiling:13});
 assert.equal(insufficient.status,'BLOCKED');
 assert.equal(insufficient.effectiveMax,13);
 assert(insufficient.coverage.counts.states.missing>0);
 assert.throws(()=>M.run({project:many.project,recoverInternalFrontiers:true,internalPassLimit:65}),/internal-passes/);
 assert.throws(()=>M.run({project:many.project,recoverInternalFrontiers:true,internalPassLimit:0}),/internal-passes/);
 assert.throws(()=>M.run({project:many.project,recoverInternalFrontiers:true,budgetCeiling:12}),/budget-ceiling/);
 assert.throws(()=>M.run({project:many.project,internalPassLimit:8}),/requires/);
 assert.throws(()=>M.run({project:many.project,budgetCeiling:32}),/requires/);
 const cmd=cp.spawnSync(process.execPath,[path.join(__dirname,'../tools/forja65.js'),
  'migrate-smw-cfg',many.project,'--recover-internal-frontiers','--internal-passes','24','--budget-ceiling','32'],
 {encoding:'utf8',timeout:45000});
 assert.equal(cmd.status,0,cmd.stderr);
 assert.equal(JSON.parse(cmd.stdout).status,'READY');
 const applied=M.run({project:many.project,apply:true,recoverInternalFrontiers:true,budgetCeiling:32});
 assert.equal(applied.status,'APPLIED');
 assert(M.compareCoverage(many.old,JSON.parse(fs.readFileSync(many.cachePath))).complete);
 assert.equal(JSON.parse(fs.readFileSync(path.join(many.project,'analysis/generation-options.json'))).max,24);
 assert.equal(JSON.parse(fs.readFileSync(path.join(many.project,'analysis/generation-options.json'))).internalReplay,true,'supervised migration must restore the ordinary creator replay preference');
 assert.deepEqual(fs.readFileSync(sourceFile),source,'migration modified user C++ source');
 assert(fs.existsSync(path.join(many.project,'reports/cfg-cache-smw-migration.json')));
 // A complete state count is not license to accept different bytes.
 const altered=setup('altered');
 const record=JSON.parse(fs.readFileSync(altered.cachePath));
 record.functions[0].instructions[1].opcode=0xEA;
 fs.writeFileSync(altered.cachePath,JSON.stringify(record));
 const nope=M.run({project:altered.project,apply:true,recoverInternalFrontiers:true,budgetCeiling:32});
 assert.equal(nope.status,'BLOCKED');
 assert(nope.coverage.counts.instructionSemantics.missing>0);
 assert.equal(JSON.parse(fs.readFileSync(altered.cachePath)).version,'0.4.29-monotonic-cfg-growth');
 // A third-party edit still blocks --apply even with complete high-budget CFG.
 const edited=setup('edited');
 fs.appendFileSync(path.join(edited.project,'src/main.cpp'),'\n// CUSTOM PATCH\n');
 const noOverwrite=M.run({project:edited.project,apply:true,recoverInternalFrontiers:true,budgetCeiling:32});
 assert.equal(noOverwrite.status,'BLOCKED');
 assert(noOverwrite.edited_sources.some(s=>s.includes('src/main.cpp')));
 const direct=setup('direct');
 const high=M.run({project:direct.project,apply:false,max:32,recoverInternalFrontiers:true});
 assert.equal(high.status,'READY');
 assert.equal(high.internal.passes.length,0);
 assert.equal(high.effectiveMax,32);
 console.log('SMW_MULTIPATH_BUDGET_PASS states=31 legacy_passes=6 extended_passes='+morePasses.internal.passes.length+
  ' staged_budgets=24 complete=1 reject_tamper=1 reject_edited=1 fail_closed=1');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
