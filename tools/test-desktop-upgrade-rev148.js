'use strict';
// Usage: node tools/test-desktop-upgrade-rev148.js REV147-FONTE.zip [REV148-project]
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),crypto=require('crypto');
const {upgradeDesktop}=require('../tools/upgrade-desktop148');
const baseline=path.resolve(process.argv[2]||'');
assert(fs.statSync(baseline).isFile(),'Pass the original REV147 source ZIP');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'forja148-test-'));
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function snapshot(dir){const out={};for(const f of fs.readdirSync(dir).sort()){const p=path.join(dir,f);out[f]=fs.lstatSync(p).isSymbolicLink()?{symlink:fs.readlinkSync(p)}:fs.lstatSync(p).isDirectory()?snapshot(p):digest(p);}return out;}
function fixture(name){const out=path.join(temp,name);fs.mkdirSync(out);cp.execFileSync('python3',['-c',`import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1]); prefix='final-fight3-rev143/'\nfor n in z.namelist():\n if n.startswith(prefix+'src/') or n==prefix+'assets/cart-data.bin': z.extract(n,sys.argv[2])`,baseline,out]);return path.join(out,'final-fight3-rev143');}
try{
 const target=fixture('valid'),before=snapshot(target);
 const preview=upgradeDesktop(target,{check:true});assert.equal(preview.status,'ready');assert.deepStrictEqual(snapshot(target),before,'check must not write');
 const result=upgradeDesktop(target);assert.equal(result.status,'upgraded');assert(fs.existsSync(result.backup));
 const manifest=require('../profiles/ff3-native148/desktop-upgrade.json');
 for(const [name,hash] of Object.entries(manifest.after))assert.equal(digest(path.join(target,'src',name)),hash,name);
 if(process.argv[3])for(const name of Object.keys(manifest.after))assert.deepStrictEqual(fs.readFileSync(path.join(target,'src',name)),fs.readFileSync(path.resolve(process.argv[3],'src',name)),name+' expected source');
 const after=snapshot(target);assert.equal(upgradeDesktop(target).status,'already-upgraded');assert.deepStrictEqual(snapshot(target),after,'idempotent operation');
 for(const [name,mutate] of [
 ['tampered',p=>fs.appendFileSync(path.join(p,'src','dispatch.cpp'),'// local edit\n')],
 ['wrong-rom',p=>fs.writeFileSync(path.join(p,'assets','cart-data.bin'),'other game')],
 ['unknown',p=>fs.writeFileSync(path.join(p,'src','extra.cpp'),'int x;')],
 ['mixed',p=>fs.copyFileSync(path.join(__dirname,'../profiles/ff3-native148/desktop-src/main.cpp'),path.join(p,'src/main.cpp'))],
 ['symlink',p=>{fs.renameSync(path.join(p,'src'),path.join(p,'real-src'));fs.symlinkSync('real-src',path.join(p,'src'));}]
 ]){const p=fixture(name);mutate(p);const snap=snapshot(p);assert.throws(()=>upgradeDesktop(p),/unsupported|symlink|fingerprint/i,name);assert.deepStrictEqual(snapshot(p),snap,name+' writes on refusal');}
 const rollback=fixture('rollback'),rollbackBefore=snapshot(path.join(rollback,'src'));
 assert.throws(()=>upgradeDesktop(rollback,{afterReplace:()=>{throw Error('simulated storage failure');}}),/simulated storage failure/);
 assert.deepStrictEqual(snapshot(path.join(rollback,'src')),rollbackBefore,'rollback restores exact source');
 assert.equal(upgradeDesktop(rollback).status,'upgraded','retry after rollback');
 console.log('PASS desktop REV148: preview, exact source upgrade, backup, idempotency, tampering, ROM, unknown/mixed sources, symlink refusal, rollback and retry');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
