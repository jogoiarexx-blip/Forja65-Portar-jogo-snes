#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const L=require('../tools/learn-from-interpreter.js');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-abi-rev154-'));
try {
 const src=path.join(d,'src');fs.mkdirSync(src);
 const file=path.join(src,'runtime.hpp');
 assert.throws(()=>L.verifyCpuRuntimeAbi(d),/runtime.hpp ausente/);
 fs.writeFileSync(file,'struct SnesRuntime { void advanceCpuInstruction(unsigned a,unsigned b,unsigned c,unsigned d,unsigned e,unsigned f,unsigned g,unsigned h); };');
 assert.throws(()=>L.verifyCpuRuntimeAbi(d),/10 parametros/);
 fs.writeFileSync(file,'struct SnesRuntime { void advanceCpuInstruction(unsigned a,unsigned b,unsigned c,unsigned d,unsigned e,unsigned f,unsigned g,unsigned h,unsigned w,bool z); };');
 assert.throws(()=>L.verifyCpuRuntimeAbi(d),/legacyInterruptTiming ausente/);
 fs.writeFileSync(file,'struct SnesRuntime { static bool legacyInterruptTiming(); void advanceCpuInstruction(unsigned a,unsigned b,unsigned c,unsigned d,unsigned e,unsigned f,unsigned g,unsigned h,unsigned w,bool z); };');
 assert.equal(L.verifyCpuRuntimeAbi(d).advanceCpuInstruction,10);
 console.log('REV154 ABI gate: PASS (old, missing legacy helper, compatible)');
} finally {fs.rmSync(d,{recursive:true,force:true});}
