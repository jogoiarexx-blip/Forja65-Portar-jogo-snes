#!/usr/bin/env node
'use strict';
// Deliberately explicit adapter: never rewrite an unknown game's generated main.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const profile=path.join(__dirname,'../profiles/ff3-native148');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function regular(p){const s=fs.lstatSync(p);if(s.isSymbolicLink()||!s.isFile())throw Error('Unsupported file/symlink: '+p);return fs.readFileSync(p);}
function directory(p){const s=fs.lstatSync(p);if(s.isSymbolicLink()||!s.isDirectory())throw Error('Unsupported directory/symlink: '+p);}
function sourceHashes(src){const h={};for(const name of fs.readdirSync(src).filter(n=>/\.(cpp|hpp)$/.test(n)).sort())h[name]=sha(regular(path.join(src,name)));return h;}
function matches(a,b){return JSON.stringify(Object.keys(a).sort())===JSON.stringify(Object.keys(b).sort())&&Object.keys(a).every(k=>a[k]===b[k]);}
function upgradeDesktop(project,options={}){
 const root=path.resolve(project),src=path.join(root,'src');directory(root);directory(src);directory(path.join(root,'assets'));
 const manifest=JSON.parse(regular(path.join(profile,'desktop-upgrade.json')));
 if(sha(regular(path.join(root,'assets/cart-data.bin')))!==manifest.rom_sha256)throw Error('Unsupported ROM fingerprint; expected FF3 '+manifest.runtime_rom_hash);
 const current=sourceHashes(src);
 if(matches(current,manifest.after))return {status:'already-upgraded',profile:manifest.id};
 if(!matches(current,manifest.before))throw Error('Unsupported source fingerprint: requires exact FF3 REV147 source; no files changed');
 const payload=new Map();for(const name of manifest.changed){const data=regular(path.join(profile,'desktop-src',name));if(sha(data)!==manifest.after[name])throw Error('Unsupported adapter payload fingerprint: '+name);payload.set(name,data);}
 if(options.check)return {status:'ready',profile:manifest.id,files:manifest.changed};
 // All signatures are checked before creating a lock, backup or output file.
 const lock=path.join(root,'.forja-desktop148-lock');fs.mkdirSync(lock);
 let backup,stage,changed=[];
 try{
  if(!matches(sourceHashes(src),manifest.before))throw Error('Unsupported source changed while acquiring lock');
  backup=fs.mkdtempSync(path.join(root,'forja-desktop148-backup-'));stage=fs.mkdtempSync(path.join(root,'.forja-desktop148-stage-'));
  const records=[];
  for(const [name,data] of payload){const original=path.join(src,name),exists=fs.existsSync(original);records.push({name,existed:exists});if(exists)fs.copyFileSync(original,path.join(backup,name));fs.writeFileSync(path.join(stage,name),data,{mode:exists?fs.statSync(original).mode:0o644});}
  fs.writeFileSync(path.join(backup,'restore.json'),JSON.stringify({profile:manifest.id,files:records},null,2)+'\n');
  for(const [name] of payload){fs.renameSync(path.join(stage,name),path.join(src,name));changed.push(name);if(options.afterReplace)options.afterReplace(name);}
  if(!matches(sourceHashes(src),manifest.after))throw Error('Installed source fingerprint verification failed');
  return {status:'upgraded',profile:manifest.id,backup,files:manifest.changed};
 }catch(error){
  const failures=[];for(const name of changed.reverse()){try{const old=path.join(backup,name),dest=path.join(src,name);if(fs.existsSync(old))fs.copyFileSync(old,dest);else fs.unlinkSync(dest);}catch(e){failures.push(name+': '+e.message);}}
  if(failures.length)throw Error(error.message+'; rollback incomplete, restore from '+backup+': '+failures.join('; '));
  throw error;
 }finally{if(stage)fs.rmSync(stage,{recursive:true,force:true});fs.rmdirSync(lock);}
}
module.exports={upgradeDesktop};
if(require.main===module){try{const args=process.argv.slice(2),check=args.includes('--check'),pos=args.filter(x=>x!=='--check');if(pos.length!==1||pos[0].startsWith('-'))throw Error('Usage: node tools/upgrade-desktop148.js [--check] /path/to/FF3-REV147-project');console.log(JSON.stringify(upgradeDesktop(pos[0],{check}),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
