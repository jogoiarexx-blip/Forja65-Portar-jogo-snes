#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {install}=require('../tools/install-legacy-cpu-abi');
const {verifyCpuRuntimeAbi}=require('../tools/learn-from-interpreter');
let count=0;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-r181-'));
try{
 const port=path.join(tmp,'port');fs.mkdirSync(path.join(port,'src'),{recursive:true});
 const f=path.join(port,'src/runtime.hpp');
 const legacy='#include <functional>\nstruct SnesRuntime {\n  void advanceCpuInstruction(std::uint32_t pc,unsigned cpuCycles,unsigned fetchBytes,std::uint32_t dataAddr,unsigned dataAccesses,std::uint32_t auxAddr,unsigned auxAccesses,unsigned stackAccesses){ /* old */ }\n};\n';
 // Fixture contains real newlines, not escaped slash-n sequences.
 fs.writeFileSync(f,legacy.replaceAll('\\n','\n'));
 assert.strictEqual(install(port).status,'ready');count++;
 assert(fs.readFileSync(f,'utf8').indexOf('REV181')===-1);count++;
 assert.strictEqual(install(port,true).status,'installed');count++;
 assert(verifyCpuRuntimeAbi(port).advanceCpuInstruction===10);count++;
 assert(fs.existsSync(f+'.pre-rev181.bak'));count++;
 assert.strictEqual(install(port,true).status,'already-installed');count++;
 fs.writeFileSync(f,'struct SnesRuntime { void advanceCpuInstruction(int a){}; };');
 assert.throws(()=>install(port,true),/ABI antiga desconhecida/);count++;
 console.log('REV181_ABI_BRIDGE_REGRESSION_PASS tests='+count);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
