'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Core=require('../forja65-core.js'),Bridge=require('../tools/legacy-cfg-bridge.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-cfg-bridge-test-'));
try{
 const project=path.join(dir,'project'),from=path.join(dir,'diag'),legacy=path.join(__dirname,'..');
 for(const d of ['assets','analysis','src'])fs.mkdirSync(path.join(project,d),{recursive:true});fs.mkdirSync(from);
 const rom=Core.makeSyntheticRom();fs.writeFileSync(path.join(project,'assets/cart-data.bin'),rom);
 const hash=Core.romFingerprint(Core.loadRom(new Uint8Array(rom),'test.sfc'));
 fs.writeFileSync(path.join(project,'analysis/generation-options.json'),JSON.stringify({rom:hash,max:64,cacheLimit:128}));
 fs.writeFileSync(path.join(project,'analysis/cfg-coverage-cache.json'),JSON.stringify({schema:'forja65.cfg-coverage-cache.v1',rom:hash,version:Core.VERSION,functions:[]}));
 fs.writeFileSync(path.join(project,'analysis/runtime-hints.txt'),'');fs.writeFileSync(path.join(project,'src/dispatch.cpp'),'');
 fs.writeFileSync(path.join(from,'forja65-runtime-hints.txt'),`rom=${hash} target=008100 from=008000 kind=FLOW e=1 m=1 x=1 c=0\n`);
 const o=Bridge.args(['--project',project,'--legacy-forja',legacy,'--from',from,'--max','64','--check']);
 assert.equal(Bridge.run(o).status,'CHECK_ONLY');assert.equal(Bridge.validate(o).unlearned,1);
 let meta=JSON.parse(fs.readFileSync(path.join(project,'analysis/cfg-coverage-cache.json')));
 meta.version='wrong-version';fs.writeFileSync(path.join(project,'analysis/cfg-coverage-cache.json'),JSON.stringify(meta));
 assert.throws(()=>Bridge.validate(o),/Legacy generator mismatch/);
 meta.version=Core.VERSION;fs.writeFileSync(path.join(project,'analysis/cfg-coverage-cache.json'),JSON.stringify(meta));
 fs.writeFileSync(path.join(from,'forja65-runtime-hints.txt'),'rom=0000000000000000 target=008100 from=008000 kind=FLOW e=1 m=1 x=1 c=0\n');
 assert.throws(()=>Bridge.validate(o),/matching-ROM evidence/);
 console.log('PASS legacy-cfg-bridge-v11-regression: matching engine, mismatched version, foreign ROM rejected');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
