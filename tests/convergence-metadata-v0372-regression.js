'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('node:assert/strict');
const C=require('../forja65-core'),IO=require('../tools/project-io'),{converge,cmakeConfigureArgs}=require('../tools/converge');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-converge-v0372-'));
try{
 const project=path.join(dir,'project');fs.mkdirSync(path.join(project,'analysis'),{recursive:true});
 fs.writeFileSync(path.join(project,'analysis/generation-options.json'),JSON.stringify({max:8192}));
 assert.throws(()=>converge(project,{jobs:0}),/jobs must be/);
 assert.throws(()=>converge(project,{jobs:33}),/jobs must be/);
 assert.throws(()=>converge(project,{frames:0,rounds:1}),/frames must be/);
 assert.throws(()=>converge(project,{frames:1,rounds:0}),/rounds must be/);
 assert.throws(()=>converge(project,{frames:1,rounds:1,max:'garbage'}),/max must be/);
 const build=path.join(project,'build-fast');
 assert(cmakeConfigureArgs(project,build).includes('-DCMAKE_BUILD_TYPE=Release'));
 fs.mkdirSync(build);fs.writeFileSync(path.join(build,'CMakeCache.txt'),'CMAKE_BUILD_TYPE:STRING=MinSizeRel\n');
 const options=cmakeConfigureArgs(project,build);
 assert.deepEqual(options,['-S',project,'-B',build],'existing build configuration must not be silently overwritten');
 // Cross-version caches are allowed only along explicitly audited output-only edges.
 // The active v86 decoder has a source-audited bridge to v18. Avoid
 // the obsolete v0.4.33 fixture: it predates a deliberate decoder boundary.
 const rom=C.loadRom(C.makeSyntheticRom(),'synthetic.sfc'),hash=C.romFingerprint(rom);
 const expected='0.4.36.98-rie-internal-replay';
 assert.notEqual(expected,C.VERSION,'exercise a genuine cross-version cache');
 assert.equal(IO.isAuditedCacheVersion('0.4.36.2-dkc3-ppu-audit'),false,'changed decoder must reject old caches');
 const sample={schema:'forja65.cfg-coverage-cache.v1',rom:hash,version:expected,functions:[],staticReturnTargets:[]};
 // REV202: .118 mudou o decodificador de CFG; nenhum cache anterior e aceito (nem a .98 auditada ate a .117).
 assert.equal(IO.isAuditedCacheVersion(expected,'0.4.36.117-legacy-port-archaeology'),true);
 assert.throws(()=>IO.mergeCfgCoverage({functions:[],instructions:[],staticReturnTargets:[],syntheticReturnTargets:[]},sample,hash),/cache incompatible/);
 assert.equal(IO.mergeCfgCoverage({functions:[],instructions:[],staticReturnTargets:[],syntheticReturnTargets:[]},{...sample,version:C.VERSION},hash).retained,0);
 assert.throws(()=>IO.mergeCfgCoverage({functions:[],instructions:[]},{...sample,version:'0.3.67-stack-evidence-ppu-brightness'},hash),/cache incompatible/);
 assert.throws(()=>IO.mergeCfgCoverage({functions:[],instructions:[]},{...sample,version:'0.3.60-unknown'},hash),/cache incompatible/);
 assert.throws(()=>IO.mergeCfgCoverage({functions:[],instructions:[]},{...sample,rom:'bad'},hash),/cache incompatible/);
 console.log('CONVERGENCE_METADATA_V0372=PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
