'use strict';
// Standalone synthetic reset path. Expected WRAM signature is $0001 at $7E0100.
const C=require(process.env.FORJA_TEST_CORE||'../forja65-core');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const bytes=C.makeSyntheticRom();
bytes.set([0x78,0x18,0xfb,0xe2,0x20,0xa9,0x34,0x8d,0x81,0x21,0xa9,0x12,0x8d,0x82,0x21,0xa9,0x00,0x8d,0x83,0x21,
 0x8f,0x34,0x12,0x7e,0x8f,0x35,0x12,0x7e,0x8f,0x00,0x12,0x7e,0x8f,0x01,0x12,0x7e,
 0xc2,0x20,0xee,0x80,0x21,0xaf,0x00,0x12,0x7e,0x8f,0x00,0x01,0x7e,0xdb],0);
// Power-of-two 32KiB LoROM: checksum+complement bytes always total 510.
bytes[0x7fdc]=bytes[0x7fdd]=255;bytes[0x7fde]=bytes[0x7fdf]=0;const sum=bytes.reduce((a,b)=>a+b,0)&65535;
bytes[0x7fdc]=(~sum)&255;bytes[0x7fdd]=((~sum)>>>8)&255;bytes[0x7fde]=sum&255;bytes[0x7fdf]=sum>>>8;
const r=C.loadRom(bytes,'rmw-word-minimal.sfc'),p=C.generateProject(r,C.analyze(r,1024));const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rmw-minimal-'));
try{for(const[n,v]of Object.entries(p))if(n.startsWith('src/')||n==='assets/cart-data.bin'){const f=path.join(dir,n);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v);}fs.copyFileSync(path.join(__dirname,'../tests/fixtures/rmw_minimal_v043622.cpp'),path.join(dir,'probe.cpp'));
 const units=Object.keys(p).filter(n=>/^src\/generated_.*\.cpp$/.test(n)||n==='src/dispatch.cpp'||n==='src/native_hooks.cpp');fs.writeFileSync(path.join(dir,'generated-unity.cpp'),units.map(n=>'#include '+JSON.stringify(n)).join('\n')+'\n');const args=['-std=c++20','-O0','-Isrc','probe.cpp','generated-unity.cpp','-o','probe'];if(process.platform==='win32')args.push('-luser32','-lgdi32','-lxinput9_1_0','-lwinmm');cp.execFileSync(process.env.CXX||'g++',args,{cwd:dir,stdio:'inherit'});const q=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,encoding:'utf8',timeout:30000,env:{...process.env,FORJA65_HEADLESS_FRAMES:'0'}});process.stdout.write(q.stdout||'');process.stderr.write(q.stderr||'');if(process.env.FORJA_TEST_OUTPUT_DIR){fs.mkdirSync(process.env.FORJA_TEST_OUTPUT_DIR,{recursive:true});for(const[n,target]of [['assets/cart-data.bin','rmw-word-minimal.sfc'],['rmw-minimal-results.json','rmw-minimal-results.json'],['rmw-minimal-native.csv','rmw-minimal-native.csv']])fs.copyFileSync(path.join(dir,n),path.join(process.env.FORJA_TEST_OUTPUT_DIR,target));}assert.equal(q.status,0,'reset path must write signature 0001 and preserve the intended WRAM port target');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
