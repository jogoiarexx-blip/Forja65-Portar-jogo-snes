#!/usr/bin/env node
'use strict';
// Testa a integracao real em fontes geradas, sem executar a compilacao C++ completa.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const F=require('../forja65-core.js'),L=require('../tools/learn-from-interpreter.js');
const romBytes=F.makeSyntheticRom();romBytes.fill(0xEA,0,0x7FC0);
romBytes.set([0x18,0xFB,0xC2,0x30,0xA9,0xFF,0x8F,0x1A,0x85,0x10,0x6C,0x10,0x00],0);
romBytes.set([0xA9,0x34,0x12,0x85,0x20,0xE6,0x22,0x4C,0x04,0x80],0x1000);
const rom=F.loadRom(romBytes,'test.sfc');
const log=L.parseLog('009000 M0X0 from=00800A count=3\n');
const learned=L.learn(rom,log,F.romFingerprint(rom));
assert.equal(learned.accepted.length,1);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja138-integrate-'));
try{
  const orig=F.generateProject(rom,F.analyze(rom,4096));
  const fresh=F.generateProject(rom,F.analyze(rom,4096,F.parseRuntimeHints(learned.hintsText)));
  assert(!/^\{0x009000u,/m.test(orig['src/dispatch.cpp']));
  assert(/^\{0x009000u,/m.test(fresh['src/dispatch.cpp']));
  for(const [rel,data] of Object.entries(orig)){
    const full=path.join(dir,rel);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,data);
  }
  const before=fs.readFileSync(path.join(dir,'src','dispatch.cpp'),'utf8');
  const cmBefore=fs.readFileSync(path.join(dir,'CMakeLists.txt'),'utf8');
  assert.throws(()=>L.integrate(dir,fresh,new Set([0x009000]),'t138',150,{failAfter:1}),/falha injetada/);
  assert.equal(fs.readFileSync(path.join(dir,'src','dispatch.cpp'),'utf8'),before);
  assert.equal(fs.readFileSync(path.join(dir,'CMakeLists.txt'),'utf8'),cmBefore);
  assert(!fs.readdirSync(path.join(dir,'src')).some(s=>s.startsWith('forja_learned_t138_')));
  const result=L.integrate(dir,fresh,new Set([0x009000]),'t138',150);
  assert(result.rotinas>0&&result.linhas>0&&result.arquivos.length>0);
  assert(/^\{0x009000u,.*_t138,0x009000u\},$/m.test(fs.readFileSync(path.join(dir,'src','dispatch.cpp'),'utf8')));
  assert(fs.readFileSync(path.join(dir,'CMakeLists.txt'),'utf8').includes(result.arquivos[0]));
  assert.throws(()=>L.integrate(dir,fresh,new Set([0x009000]),'t138',150),/ja integrado/);
  console.log('interpreter-integration-rev138: PASS (falha simulada e integracao real; '+result.linhas+' linhas, '+result.arquivos.length+' shards)');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
