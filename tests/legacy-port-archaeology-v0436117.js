'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const C=require('../forja65-core'),L=require('../tools/legacy-port-archaeology');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-legacy-117-'));
const make=(name,rom,hook,zip=false,withoutRom=false)=>{const files={'src/native_hooks.cpp':Buffer.from(hook),'src/runtime.cpp':Buffer.from('CPU'),'src/helper.h':Buffer.from('flags')};if(!withoutRom)files['assets/cart-data.bin']=rom;
 if(zip){const out=path.join(temp,name+'.zip');fs.writeFileSync(out,Buffer.from(C.buildZip(Object.fromEntries(Object.entries(files).map(([k,v])=>[name+'/'+k,v])))));return out;}
 const out=path.join(temp,name);for(const [f,b] of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(out,f)),{recursive:true});fs.writeFileSync(path.join(out,f),b);}return out;};
try{
 const rom=Buffer.from(C.makeSyntheticRom()),other=Buffer.from(rom);other[0x710]^=1;
 const romPath=path.join(temp,'game.sfc'),home=path.join(temp,'vault');fs.writeFileSync(romPath,rom);
 const a=make('Demo-v0.1.0',rom,'old hook',true),b=make('Demo-v0.2.0',rom,'fixed hook'),c=make('Demo-v0.3.0',other,'foreign',true),d=make('Demo-v0.4.0',rom,'fixed hook',true,true);
 const api=L.open(romPath,{home}),r0=api.importFrom(temp);
 assert.equal(r0.mode,'preview');assert.equal(r0.compatible,2);assert.equal(r0.distinctSnapshots,2);assert.equal(r0.newSnapshots,0);assert.equal(api.report().storedSnapshots,0);assert.ok(r0.skipped.some(x=>x.reason==='different-rom-sha256'));assert.ok(r0.skipped.some(x=>x.reason.includes('ROM identity unavailable')));
 const r1=api.importFrom(temp,{apply:true});assert.equal(r1.newSnapshots,2);assert.equal(r1.newComparisons,1);assert.equal(api.report().storedSnapshots,2);
 const report=api.report();assert.equal(report.storedComparisons,1);assert.equal(report.recentComparisons[0].changedFiles,1);assert.equal(report.recentComparisons[0].files[0].status,'historical-candidate-unverified');
 assert.equal(api.importFrom(temp,{apply:true}).newSnapshots,0);
 const manual=api.importFrom(d,{apply:true,assumeSameRom:true});assert.equal(manual.newSnapshots,1);assert.ok(api.report().versions.some(x=>x.identityConfidence==='manual-rom-association-unverified'));
 const saved=fs.readFileSync(path.join(b,'src/native_hooks.cpp'),'utf8');assert.equal(saved,'fixed hook');
 const noRomDir=make('Demo-v0.5.0',rom,'historical override',false,true);
 const attested=api.importFrom(noRomDir,{apply:true,assumeSameRom:true});assert.equal(attested.newSnapshots,1);
 const foreignPath=path.join(temp,'foreign.sfc');fs.writeFileSync(foreignPath,other);
 const foreignVault=L.open(foreignPath,{home});assert.equal(foreignVault.report().storedSnapshots,0);
} catch(e){throw e;}
finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('PASS legacy archaeology: preview, directory/ZIP, ROM isolation, idempotence, manual identity, no source writes');
