'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),C=require('../forja65-core'),IO=require('../tools/project-io'),Vault=require('../tools/knowledge-vault');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-compat-116-'));
try{
 for(const v of ['0.4.36.115-regression-intelligence','0.4.36.114-runtime-evidence-vault','0.4.36.113-ui-repair-vault','0.4.36.112-knowledge-vault']){assert.equal(IO.isAuditedCacheVersion(v,'0.4.36.117-legacy-port-archaeology'),true,'lineage up to .117 preserved '+v);assert.equal(IO.isAuditedCacheVersion(v),false,'REV202 rejects '+v);}
 assert.equal(IO.isAuditedCacheVersion('0.4.36.2-dkc3-ppu-audit'),false,'unaudited legacy must not execute directly');
 const raw=C.makeSyntheticRom(),rom=C.loadRom(raw,'game.sfc'),home=path.join(dir,'vault');
 const vault=Vault.instance(rom,raw,{home});const r=path.join(dir,'game.sfc');fs.writeFileSync(r,raw);
 const a=IO.generate({romPath:r,out:path.join(dir,'fresh'),knowledgeHome:home,max:64});
 const previous=JSON.parse(fs.readFileSync(path.join(dir,'fresh','analysis','cfg-coverage-cache.json')));
 previous.version='0.4.36.115-regression-intelligence';vault.save({cache:previous,origin:'audited-prior-release'});
 const imported=vault.load({isCompatible:IO.isAuditedCacheVersion});
 // REV202: o cache v115 fica guardado como oldCache (so semente); o compativel e o desta versao.
 assert.equal(imported.cache&&imported.cache.version,C.VERSION,'compatible cache must be the active release');
 assert.equal(imported.oldCache&&imported.oldCache.version,'0.4.36.115-regression-intelligence','v115 cache kept only as legacy seeds');
 const b=IO.generate({romPath:r,out:path.join(dir,'reuse'),knowledgeHome:home,max:64});
 assert.equal(b.vault.restored.compatibleCfg,true);assert.equal(b.a.decoded,a.a.decoded);
 console.log('PASS: v112-115 audited CFG lineage retained in v116; unaudited DKC3 legacy guarded');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
