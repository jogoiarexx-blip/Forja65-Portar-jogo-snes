'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const F=require('../forja65-core');const rom=F.loadRom(F.makeSyntheticRom());
const files=F.generateProject(rom,F.analyze(rom,96));const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-consolidated193-'));
try{
 for(const[n,v]of Object.entries(files))if(n.startsWith('src/')){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
 fs.copyFileSync(path.join(__dirname,'fixtures/consolidated_runtime_rev193.cpp'),path.join(dir,'probe.cpp'));
 const build=cp.spawnSync(process.env.CXX||'g++',['-std=c++20','-O0','-Wall','-Wextra','-Wpedantic','-Werror','-DFORJA65_ENABLE_TRACE=0','-Isrc','probe.cpp','-o','probe'],{cwd:dir,encoding:'utf8',timeout:120000});
 assert.equal(build.status,0,build.stderr||build.error?.message);
 const run=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,encoding:'utf8',timeout:30000});process.stdout.write(run.stdout||'');assert.equal(run.status,0,run.stderr||run.error?.message);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
