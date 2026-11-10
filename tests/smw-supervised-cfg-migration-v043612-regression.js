'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const C=require('../forja65-core.js');
const SMW=require('../crossfeed-historico/smw-monotonic/forja65-core.js');
const IO=require('../tools/project-io.js');
const Migrator=require('../tools/migrate-smw-cfg-cache.js');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-smw-supervised-test-'));
const oldVersion='0.4.29-monotonic-cfg-growth';
function setup(name,mutateRom=null){
 const project=path.join(temp,name),romPath=path.join(temp,name+'.sfc');
 const bytes=C.makeSyntheticRom();if(mutateRom)mutateRom(bytes);fs.writeFileSync(romPath,bytes);
 const result=IO.generate({romPath,out:project,max:72,cacheLimit:512});
 const currentHash=C.romFingerprint(C.loadRom(bytes));
 const old=SMW.analyze(SMW.loadRom(bytes),72);
 const cache={...IO.makeCfgCache(old,currentHash),version:oldVersion};
 fs.writeFileSync(path.join(project,'analysis/cfg-coverage-cache.json'),JSON.stringify(cache)+'\n');
 return {project,romPath,cache,hash:currentHash};
}
try{
 const {project,cache}=setup('healthy');
 assert.equal(IO.isAuditedCacheVersion(oldVersion),false,'divergent SMW cache must remain blocked by default');
 const opts={project,apply:false};
 const cachePath=path.join(project,'analysis/cfg-coverage-cache.json');
 const legacy=fs.readFileSync(cachePath);
 const beforeMain=fs.readFileSync(path.join(project,'src/main.cpp'));
 const dry=Migrator.run(opts);
 const cli=cp.spawnSync(process.execPath,[path.join(__dirname,'../tools/forja65.js'),'migrate-smw-cfg',project],{encoding:'utf8',timeout:30000});
 assert.equal(cli.status,0,cli.stderr);
 assert.equal(JSON.parse(cli.stdout).status,'READY');
 assert.equal(dry.status,'READY',JSON.stringify(dry,null,2));
 assert(dry.coverage.complete);
 assert.equal(fs.readFileSync(cachePath).toString(),legacy.toString(),'dry-run must never modify original');
 assert.deepEqual(fs.readFileSync(path.join(project,'src/main.cpp')),beforeMain);
 assert(dry.changed_files.includes('analysis/cfg-coverage-cache.json'));
 const applied=Migrator.run({...opts,apply:true});
 assert.equal(applied.status,'APPLIED');
 assert.equal(JSON.parse(fs.readFileSync(cachePath)).version,C.VERSION);
 assert(fs.existsSync(path.join(project,'reports/cfg-cache-smw-migration.json')));
 assert.deepEqual(fs.readFileSync(path.join(project,'src/main.cpp')),beforeMain);
 assert.equal(Migrator.compareCoverage(cache,JSON.parse(fs.readFileSync(cachePath))).complete,true);
 assert.throws(()=>Migrator.validate(project),/Unsupported cache schema\/version/,'migration is one-shot');
 // Coverage from old cache cannot be blindly imported. A fictitious historical
 // instruction is never reconstructed by the active ROM decoder.
 const lost=setup('missing');
 const target=path.join(lost.project,'analysis/cfg-coverage-cache.json');
 const injected=JSON.parse(fs.readFileSync(target));
 injected.functions[0].instructions.push({...injected.functions[0].instructions[0],stateKey:'FICTITIOUS-CPU-STATE'});
 fs.writeFileSync(target,JSON.stringify(injected));
 const blocked=Migrator.run({project:lost.project,apply:true});
 assert.equal(blocked.status,'BLOCKED');
 assert.equal(blocked.coverage.complete,false);
 assert(blocked.coverage.counts.states.missing>0);
 assert.equal(JSON.parse(fs.readFileSync(target)).version,oldVersion);
 // An existing edited generated source must not be overwritten even when
 // the staged version would restore it to the manifest's expected state.
 const edited=setup('edited');
 const custom=path.join(edited.project,'src/main.cpp');fs.appendFileSync(custom,'\n// personal-modification\n');
 const blockedEdit=Migrator.run({project:edited.project,apply:true});
 assert.equal(blockedEdit.status,'BLOCKED');
 assert(blockedEdit.edited_sources.some(s=>s.includes('src/main.cpp')),JSON.stringify(blockedEdit.edited_sources));
 assert(fs.readFileSync(custom,'utf8').includes('personal-modification'));
 // The SMW decoder excludes reset-vector-table JML stubs while the newer
 // decoder recognizes the exact, ROM-backed reset trampoline. This is the
 // real behavior difference behind the incompatible cache lineage.
 const trampoline=setup('trampoline',rom=>{
  rom[0x7FFC]=0xE0;rom[0x7FFD]=0xFF; // reset vector = $FFE0
  rom.set([0x5C,0x00,0x80,0x00],0x7FE0); // JML $008000
 });
 assert.equal(trampoline.cache.functions.length,0);
 const newResult=Migrator.run({project:trampoline.project,apply:true});
 assert.equal(newResult.status,'APPLIED',JSON.stringify(newResult,null,2));
 assert(newResult.coverage.counts.functions.new>0,'new ROM-backed reset trampoline discovered');
 // Tampered provenance and other ROMs are refused before staging.
 const foreign=setup('foreign');
 const p=path.join(foreign.project,'analysis/cfg-coverage-cache.json');
 const c=JSON.parse(fs.readFileSync(p));c.rom='0000000000000000';fs.writeFileSync(p,JSON.stringify(c));
 assert.throws(()=>Migrator.run({project:foreign.project}),/ROM fingerprint mismatch/);
 console.log('SMW_SUPERVISED_CFG_MIGRATION_PASS ready=1 applied=1 lost_state=blocked edited_source=blocked wrong_rom=blocked reset_trampoline=rebuilt');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
