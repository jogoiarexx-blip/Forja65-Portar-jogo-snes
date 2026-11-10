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
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'forja-smw-rom-recovery-'));
const oldVersion='0.4.29-monotonic-cfg-growth';
function project(name){
 const out=path.join(temporary,name),romPath=path.join(temporary,name+'.sfc');
 const bytes=C.makeSyntheticRom();
 // Independent ROM-backed routine not reachable from reset in this fixture.
 bytes.set([0xea,0xea,0x60],0x100);
 fs.writeFileSync(romPath,bytes);
 IO.generate({romPath,out,max:72,cacheLimit:512});
 const rom=C.loadRom(bytes),hash=C.romFingerprint(rom);
 const observed={target:0x008100,from:null,kind:'STATE',state:{emulation:true,m8:true,x8:true,carry:null},rom:hash,observed:1};
 const analysis=SMW.analyze(rom,72,[observed]);
 const old={...IO.makeCfgCache(analysis,hash),version:oldVersion};
 assert(old.functions.some(f=>f.start===0x8100),'fixture missing historical 8100');
 const cache=path.join(out,'analysis/cfg-coverage-cache.json');
 fs.writeFileSync(cache,JSON.stringify(old)+'\n');
 return {out,cache,old,rom};
}
try{
 const healthy=project('recovered');
 const before=fs.readFileSync(healthy.cache);
 const originalCpp=fs.readFileSync(path.join(healthy.out,'src/main.cpp'));
 const strict=M.run({project:healthy.out,apply:false});
 assert.equal(strict.status,'BLOCKED','default must not trust legacy entry points');
 assert(strict.coverage.counts.functions.missing>0);
 const preview=M.run({project:healthy.out,apply:false,recoverLegacySeeds:true});
 assert.equal(preview.status,'READY',JSON.stringify(preview,null,2));
 assert.equal(preview.recovery.accepted,1);
 assert.equal(preview.recovery.missingFunctions,1);
 assert.equal(preview.recovery.coverageBefore.functions.missing,1);
 assert.equal(preview.coverage.complete,true);
 assert(fs.readFileSync(healthy.cache).equals(before),'dry run must preserve legacy cache');
 assert(fs.readFileSync(path.join(healthy.out,'src/main.cpp')).equals(originalCpp),'dry run modified project');
 const cli=cp.spawnSync(process.execPath,[path.join(__dirname,'../tools/forja65.js'),
  'migrate-smw-cfg',healthy.out,'--recover-legacy-seeds'],{encoding:'utf8',timeout:60000});
 assert.equal(cli.status,0,cli.stderr);
 assert.equal(JSON.parse(cli.stdout).status,'READY');
 const applied=M.run({project:healthy.out,apply:true,recoverLegacySeeds:true});
 assert.equal(applied.status,'APPLIED',JSON.stringify(applied,null,2));
 const migrated=JSON.parse(fs.readFileSync(healthy.cache));
 assert.equal(migrated.version,C.VERSION);
 assert(migrated.functions.some(f=>f.start===0x8100),'active decoder did not reconstruct independent routine');
 assert(M.compareCoverage(healthy.old,migrated).complete);
 // Active decoded bytes are independently generated rather than copied.
 assert.deepEqual(migrated.functions.find(f=>f.start===0x8100).instructions.map(i=>i.opcode),[0xea,0xea,0x60]);
 const report=JSON.parse(fs.readFileSync(path.join(healthy.out,'reports/cfg-cache-smw-migration.json')));
 assert.equal(report.recovery.accepted,1);
 assert.equal(report.status,'APPLIED');
 // Tampered first opcode is never used as a seed even when opt-in is enabled.
 const tampered=project('changed-opcode');
 const oldTampered=JSON.parse(fs.readFileSync(tampered.cache));
 oldTampered.functions.find(f=>f.start===0x8100).instructions[0].opcode=0xa9;
 fs.writeFileSync(tampered.cache,JSON.stringify(oldTampered));
 const rejected=M.run({project:tampered.out,apply:true,recoverLegacySeeds:true});
 assert.equal(rejected.status,'BLOCKED');
 assert.equal(rejected.recovery.accepted,0);
 assert(rejected.recovery.rejections.some(e=>e.reason.includes('opcode differs')));
 assert.equal(JSON.parse(fs.readFileSync(tampered.cache)).version,oldVersion);
 // The same stateKey must not be accepted if an opcode was altered while
 // retaining the original state-key, address and function membership.
 const badSemantics=project('opcode-semantics');
 const changed=JSON.parse(fs.readFileSync(badSemantics.cache));
 const regular=changed.functions.find(f=>f.start===0x8000);
 regular.instructions[1].opcode=0x02;
 fs.writeFileSync(badSemantics.cache,JSON.stringify(changed));
 const semanticResult=M.run({project:badSemantics.out,apply:true,recoverLegacySeeds:true});
 assert.equal(semanticResult.status,'BLOCKED');
 assert(semanticResult.coverage.counts.instructionSemantics.missing>0);
 assert.equal(JSON.parse(fs.readFileSync(badSemantics.cache)).version,oldVersion);
 // A stale/bogus ROM entry also remains blocked.
 const invalid=project('outside-rom');
 const wrong=JSON.parse(fs.readFileSync(invalid.cache));
 const oldFn=wrong.functions.find(f=>f.start===0x8100);
 oldFn.start=0x7e8100;
 oldFn.functionKey='8290560|111Q';
 oldFn.instructions[0].pc=oldFn.start;
 fs.writeFileSync(invalid.cache,JSON.stringify(wrong));
 const invalidResult=M.run({project:invalid.out,apply:true,recoverLegacySeeds:true});
 assert.equal(invalidResult.status,'BLOCKED');
 assert(invalidResult.recovery.rejections.some(e=>e.reason.includes('not a ROM address')));
 // Older generator versions did not list the CFG budget diagnostic in the
 // manifest. Migration must back it up byte-for-byte instead of overwriting.
 const legacyReport=project('legacy-untracked-report');
 const budgetName='reports/cfg-discovery-budget.json';
 const budgetPath=path.join(legacyReport.out,budgetName);
 const beforeBudget=fs.readFileSync(budgetPath);
 const manifestPath=path.join(legacyReport.out,'forja65-build-manifest.txt');
 const lines=fs.readFileSync(manifestPath,'utf8').split(/\r?\n/).filter(line=>!line.startsWith('file='+budgetName+' '));
 fs.writeFileSync(manifestPath,lines.join('\n'));
 const legacyApplied=M.run({project:legacyReport.out,apply:true,recoverLegacySeeds:true});
 assert.equal(legacyApplied.status,'APPLIED',JSON.stringify(legacyApplied,null,2));
 assert(legacyApplied.preserved_untracked_reports.includes(budgetName));
 const archived=legacyApplied.changed_files.find(n=>n.startsWith('reports/cfg-discovery-budget.pre-smw-'));
 assert(archived,'original diagnostic not backed up');
 assert(fs.readFileSync(path.join(legacyReport.out,archived)).equals(beforeBudget));
 // A previously user-edited generated source cannot be overwritten on opt-in.
 const edited=project('edited-source');
 const cpp=path.join(edited.out,'src/main.cpp');fs.appendFileSync(cpp,'\n// local change\n');
 const blocked=M.run({project:edited.out,apply:true,recoverLegacySeeds:true});
 assert.equal(blocked.status,'BLOCKED');
 assert(blocked.edited_sources.some(e=>e.includes('src/main.cpp')));
 assert(fs.readFileSync(cpp,'utf8').includes('// local change'));
 console.log('SMW_ROM_BACKED_CFG_RECOVERY_PASS strict_block=1 preview=1 CLI=1 apply=1 altered_opcode_block=1 changed_semantics_block=1 invalid_rom_block=1 legacy_report_backup=1 edited_source_block=1');
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
