'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const F=require(process.env.FORJA_TEST_CORE||'../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,96));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-return-native193-'));
try{
 for(const [n,v]of Object.entries(files))if(n.startsWith('src/')){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
 fs.copyFileSync(path.join(__dirname,'fixtures/constructed_short_native_rom_rev193.cpp'),path.join(dir,'probe.cpp'));
 const build=cp.spawnSync(process.env.CXX||'g++',['-std=c++20','-O0','-DFORJA65_ENABLE_TRACE=0','-Isrc','probe.cpp','-o','probe'],{cwd:dir,encoding:'utf8',timeout:120000});
 assert.equal(build.status,0,build.stderr||build.error?.message);
 const run=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,encoding:'utf8',timeout:20000});
 process.stdout.write(run.stdout||'');assert.equal(run.status,0,run.stderr||'native-ROM return guard failed');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
