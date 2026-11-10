'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core');
const b=C.makeSyntheticRom();b.set([0xd0,8,0x20,0,0x81,0xa9,0x34,0xea,0xea,0xdb,0x4c,5,0x80]);b.set([0x18,0xfb,0xc2,0x20,0x60],0x100);const rom=C.loadRom(b),first=C.analyze(rom,3,[],{globalCfg:false,internalCoverage:new Map()});
assert(first.instructions.find(i=>i.pc===0x8005).returnSite);
const coverage=new Map(first.functions.map(f=>[f.functionKey,new Map(f.instructions.map(i=>[i.stateKey,i.raw.join(',')+'|'+i.size]))])),focus=new Map(first.functions.map(f=>[f.functionKey,new Set(f.internalFrontier)]));
const fresh=C.analyze(rom,2,[],{globalCfg:false,internalCoverage:coverage,focusFrontiers:focus,internalReplayBudget:8});assert(!fresh.instructions.find(i=>i.pc===0x8005).returnSite,'reproduced alternate predecessor without revisiting JSR');
const merged=C.mergeCfgCoverageRecords(fresh,{rom:C.romFingerprint(rom),functions:first.functions,staticReturnTargets:first.staticReturnTargets,syntheticReturnTargets:first.syntheticReturnTargets},C.romFingerprint(rom)).a;
assert(merged.functions[0].calls.some(c=>c.from===0x8002));assert(merged.functions[0].instructions.find(i=>i.pc===0x8005).returnSite,'retained JSR must retain return-site CPU guard annotation');
const files=C.generateProject(rom,merged),native=Object.keys(files).filter(n=>/^src\/generated_/.test(n)).map(n=>files[n]).join('\n');assert(native.includes('callee devolveu M/X/E diferente do previsto'),'generated native code must guard alternate callee E/M/X');
console.log('INTERNAL_RETAINED_CALL_RETURN_SITE_GENERATED_CPU_GUARD_PASS');
// Execute the width-changing callee, then dispatch its return into a proven
// 16-bit continuation. Without the retained guard A becomes 0034, not EA34.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const complete=C.analyze(rom,128,[],{globalCfg:false,discoverySeeds:[{start:0x8005,state:{emulation:false,m8:false,x8:true,carry:true}}]}),extras=complete.functions.filter(f=>f.start===0x8100||f.start===0x8005),executable=C.mergeCfgCoverageRecords({...merged,functions:extras},{rom:C.romFingerprint(rom),functions:merged.functions,staticReturnTargets:merged.staticReturnTargets,syntheticReturnTargets:merged.syntheticReturnTargets},C.romFingerprint(rom)).a;
assert(extras.some(f=>f.start===0x8005&&f.instructions.some(i=>i.pc===0x8005&&i.size===3)));
const project=C.generateProject(rom,executable),dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-return-guard-native-'));
try{
 for(const [n,v]of Object.entries(project))if(n.startsWith('src/')||n==='assets/cart-data.bin'){const file=path.join(dir,n);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,v);}
 fs.writeFileSync(path.join(dir,'probe.cpp'),'#include "generated.hpp"\n#include <iostream>\nint main(){SnesRuntime h("assets/cart-data.bin",MapperKind::LoROM);CpuState c;c.enforceEmulation();c.z=true;c.s=0x1ff;forja65_dispatch(c,h,0x8000,0xffffff);if(!h.stopped||c.a!=0xea34||c.s!=0x1ff||c.e||c.m8||!c.x8)return 3;std::cout<<"INTERNAL_RETURN_GUARD_NATIVE_LDA16_STACK_MODE_PASS\\n";}\n');
 const flags=['-std=c++20','-O0','-DFORJA65_ENABLE_TRACE=0','-DFORJA65_STACKLESS_CALLS=0'];cp.execFileSync('g++',[...flags,'-x','c++-header','src/runtime.hpp','-o','src/runtime.hpp.gch'],{cwd:dir,stdio:'pipe'});const units=Object.keys(project).filter(n=>/^src\/generated_.*\.cpp$/.test(n)||n==='src/dispatch.cpp'||n==='src/native_hooks.cpp'),args=[...flags,'-include','src/runtime.hpp','-Isrc','probe.cpp',...units,'-o','probe'];if(process.platform==='win32')args.push('-luser32','-lgdi32','-lxinput9_1_0','-lwinmm');cp.execFileSync('g++',args,{cwd:dir,stdio:'pipe'});const q=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,encoding:'utf8',timeout:20000});assert.equal(q.status,0,q.stdout+q.stderr);process.stdout.write(q.stdout);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
