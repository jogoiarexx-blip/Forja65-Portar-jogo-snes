'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const C=require('../forja65-core.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev207-'));
try{
 for(const dir of ['analysis','assets','src'])fs.mkdirSync(path.join(tmp,dir));
 const rom=C.makeSyntheticRom();fs.writeFileSync(path.join(tmp,'assets/cart-data.bin'),Buffer.from(rom));
 const hash=C.romFingerprint(C.loadRom(rom,'cart-data.bin'));
 const hints=path.join(tmp,'analysis/runtime-hints.txt'),disp=path.join(tmp,'src/dispatch.cpp');
 const run=()=>{const p=cp.spawnSync(process.execPath,[path.join(__dirname,'../tools/verify-learned-cfg.js'),tmp],{encoding:'utf8'});return {exit:p.status,report:JSON.parse(fs.readFileSync(path.join(tmp,'reports/cfg-verification.json')))};};
 fs.writeFileSync(disp,'{0x008000u,false,false,false,false,false,&sub_008000,0x008000u},\n');
 fs.writeFileSync(hints,`rom=${hash} target=008000 from=008010 e=0 m=0 x=0 c=0\n`);
 let r=run();assert.equal(r.exit,0);assert.equal(r.report.covered,1);assert.equal(r.report.observedCovered,1);
 fs.appendFileSync(hints,'target=ZZZ e=0 m=0 x=0 c=0\n');
 r=run();assert.equal(r.exit,1);assert.equal(r.report.rejectedHints,1);assert(r.report.missing.some(x=>x.kind==='INVALID_HINT'));
 fs.writeFileSync(hints,'# No hints\n');r=run();assert.equal(r.exit,1);assert(r.report.missing.some(x=>x.kind==='NO_VALID_HINTS'));
 fs.writeFileSync(hints,`rom=${hash} target=008000 e=0 m=1 x=0 c=0\n`);r=run();assert.equal(r.exit,1);assert(r.report.missing.some(x=>x.kind==='CPU_STATE_NOT_DISPATCHED'));
 console.log('REV207_CFG_EVIDENCE_FAILCLOSED_PASS');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
