#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sums=fs.readFileSync(path.join(root,'SHA256SUMS.txt'),'utf8');
const found=new Map();const bad=[];
for(const line of sums.trim().split(/\r?\n/)){
 const m=/^([a-f0-9]{64})  (.+)$/.exec(line);
 if(!m){bad.push('invalid checksum line');continue;}
 if(found.has(m[2]))bad.push('duplicate: '+m[2]);
 found.set(m[2],m[1]);
}
function walk(dir){const out=[];for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,ent.name);
 if(ent.isDirectory()){if(!['.git','node_modules','__pycache__'].includes(ent.name))out.push(...walk(file));}
 else if(ent.isFile())out.push(path.relative(root,file).replace(/\\/g,'/'));
}return out;}
const actual=walk(root).filter(x=>x!=='SHA256SUMS.txt');
for(const file of actual){
 if(!found.has(file)){bad.push('unlisted: '+file);continue;}
 const check=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 if(check!==found.get(file))bad.push('mismatch: '+file);
}
for(const file of found.keys())if(!actual.includes(file))bad.push('missing: '+file);
for(const file of ['forja65-core.js','tools/project-io.js','tools/snes-hardware-audit.js','tests/snes-rom-indirect-v0436120-regression.js','REV120.json'])if(!actual.includes(file))bad.push('required file missing: '+file);
const ver=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
const core=fs.readFileSync(path.join(root,'forja65-core.js'),'utf8');
if(!core.includes("const VERSION='"+ver+"'"))bad.push('core VERSION mismatch');
if(fs.readFileSync(path.join(root,'VERSION.txt'),'utf8').trim()!==ver)bad.push('VERSION.txt mismatch');
console.log(JSON.stringify({status:bad.length?'FAIL':'PASS',version:ver,files:actual.length,errors:bad.slice(0,25)},null,2));
process.exitCode=bad.length?1:0;
