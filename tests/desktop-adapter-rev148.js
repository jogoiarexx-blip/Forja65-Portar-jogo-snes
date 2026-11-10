'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),cp=require('child_process');
const {upgradeDesktop}=require('../tools/upgrade-desktop148');
const profile=path.join(__dirname,'../profiles/ff3-native148');
const manifest=require('../profiles/ff3-native148/desktop-upgrade.json');
for(const n of manifest.changed)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(profile,'desktop-src',n))).digest('hex'),manifest.after[n],'distributed payload '+n);
const cli=cp.spawnSync(process.execPath,[path.join(__dirname,'../tools/upgrade-desktop148.js')],{encoding:'utf8'});assert.equal(cli.status,1);assert.match(cli.stderr,/Usage:/);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja148-refusal-'));
try{fs.mkdirSync(path.join(tmp,'src'));fs.mkdirSync(path.join(tmp,'assets'));fs.writeFileSync(path.join(tmp,'assets/cart-data.bin'),'unsupported ROM');fs.writeFileSync(path.join(tmp,'src/main.cpp'),'user code');assert.throws(()=>upgradeDesktop(tmp),/ROM fingerprint/);assert.equal(fs.readFileSync(path.join(tmp,'src/main.cpp'),'utf8'),'user code');assert.deepStrictEqual(fs.readdirSync(tmp).sort(),['assets','src']);}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log('PASS REV148 distributed payload integrity, CLI contract and unsupported ROM refusal without writes');
