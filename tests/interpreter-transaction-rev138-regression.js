#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const L=require('../tools/learn-from-interpreter.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'forja138-transaction-'));
const dir=path.join(root,'port'), src=path.join(dir,'src'), txn=path.join(dir,'.forja-learning-transaction');
const disp=path.join(src,'dispatch.cpp'), cmake=path.join(dir,'CMakeLists.txt'),
  shard=path.join(src,'forja_learned_rev138_000.cpp');
const reset=()=>{fs.mkdirSync(src,{recursive:true});fs.writeFileSync(disp,'OLD DISPATCH\n');
  fs.writeFileSync(cmake,'OLD CMAKE\n');if(fs.existsSync(shard))fs.unlinkSync(shard);};
const changes=[
  {rel:'src/forja_learned_rev138_000.cpp',content:'NEW SHARD\n',newOnly:true},
  {rel:'src/dispatch.cpp',content:'NEW DISPATCH\n'},
  {rel:'CMakeLists.txt',content:'NEW CMAKE\n'}
];
const old=()=>{assert.equal(fs.readFileSync(disp,'utf8'),'OLD DISPATCH\n');
  assert.equal(fs.readFileSync(cmake,'utf8'),'OLD CMAKE\n');
  assert(!fs.existsSync(shard));assert(!fs.existsSync(txn));};
try{
  for(let at=1;at<=3;at++){
    reset();assert.throws(()=>L.commitPortFiles(dir,changes,{failAfter:at}),/falha injetada/);
    old();
  }
  reset();L.commitPortFiles(dir,changes);
  assert.equal(fs.readFileSync(shard,'utf8'),'NEW SHARD\n');
  assert.equal(fs.readFileSync(disp,'utf8'),'NEW DISPATCH\n');
  assert.equal(fs.readFileSync(cmake,'utf8'),'NEW CMAKE\n');
  assert(!fs.existsSync(txn));
  // uma segunda integracao com mesmo nome de shard deve falhar sem tocar no port
  assert.throws(()=>L.commitPortFiles(dir,changes),/shard ja existe/);
  assert.equal(fs.readFileSync(disp,'utf8'),'NEW DISPATCH\n');
  assert.throws(()=>L.commitPortFiles(dir,[{rel:'src/../CMakeLists.txt',content:'ATTACK'}]),/caminho inseguro/);
  // Simula uma interrupcao depois de modificar 2 arquivos (journal 'prepared').
  reset();fs.mkdirSync(txn);
  fs.writeFileSync(path.join(txn,'backup-0'),'OLD DISPATCH\n');
  fs.writeFileSync(path.join(txn,'backup-1'),'OLD CMAKE\n');
  fs.writeFileSync(path.join(txn,'journal.json'),JSON.stringify({schema:'forja65.learning-transaction.v1',status:'prepared',files:[
    {rel:'src/dispatch.cpp',existed:true,backup:'backup-0',stage:'stage-0'},
    {rel:'CMakeLists.txt',existed:true,backup:'backup-1',stage:'stage-1'},
    {rel:'src/forja_learned_rev138_000.cpp',existed:false,backup:'backup-2',stage:'stage-2'}
  ]}));
  fs.writeFileSync(disp,'BROKEN DISPATCH\n');fs.writeFileSync(cmake,'BROKEN CMAKE\n');fs.writeFileSync(shard,'BROKEN SHARD\n');
  assert.equal(L.recoverInterruptedTransaction(dir),true);old();
  // Se o journal ja estiver marcado committed, apenas concluir a limpeza.
  reset();fs.mkdirSync(txn);
  fs.writeFileSync(path.join(txn,'journal.json'),JSON.stringify({schema:'forja65.learning-transaction.v1',status:'committed',files:[
    {rel:'src/dispatch.cpp',existed:true,backup:'backup-0',stage:'stage-0'}]}));
  fs.writeFileSync(path.join(txn,'backup-0'),'OLD DISPATCH\n');
  fs.writeFileSync(disp,'NEW DISPATCH\n');
  assert.equal(L.recoverInterruptedTransaction(dir),true);
  assert.equal(fs.readFileSync(disp,'utf8'),'NEW DISPATCH\n');
  assert(!fs.existsSync(txn));
  console.log('interpreter-transaction-rev138: PASS (3 falhas injetadas, sucesso, colisao, caminho inseguro, interrupcao, commit)');
} finally {fs.rmSync(root,{recursive:true,force:true});}
