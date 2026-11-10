'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'sram-path.sfc');
const files=C.generateProject(rom,C.analyze(rom,256,[]));
const rt=files['src/runtime.hpp'];
assert(rt.includes('envText("FORJA65_FRAME_HASH_PATH")'));
assert(rt.includes('sramPath(envText("FORJA65_SRAM_PATH").empty()?savePath:envText("FORJA65_SRAM_PATH"))'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'f65-sram-'));
try {
 fs.mkdirSync(path.join(dir,'src'));
 fs.writeFileSync(path.join(dir,'src/runtime.hpp'),rt);
 fs.writeFileSync(path.join(dir,'main.cpp'),`#include "runtime.hpp"
#include <cstdlib>
#include <fstream>
#include <iostream>
int main(int argc,char**argv){
 SnesRuntime h;h.sramPath=argc>1?argv[1]:"save.srm";
 h.sram.assign(16,0xFFu);h.sram[0]=0x42;h.sramDirty=true;h.saveSram();
 std::cout << (std::ifstream(h.sramPath).good()?"PASS":"FAIL") << "\\n";
 return 0;
}`);
 const bin=path.join(dir,'test');
 const result=cp.spawnSync(process.env.CXX||'c++',['-std=c++20','-O0','-g0','-I'+path.join(dir,'src'),path.join(dir,'main.cpp'),'-o',bin],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||String(result.error));
 // Validate runtime constructor via a byte-identical dummy ROM and default/override paths.
 const romfile=path.join(dir,'rom.sfc');fs.writeFileSync(romfile,Buffer.from(rom.data));
 fs.writeFileSync(path.join(dir,'constructor.cpp'),`#include "runtime.hpp"
#include <iostream>
int main(int argc,char**argv){SnesRuntime h(argv[1],MapperKind::LoROM,16,0,0,CartChip::None,argv[2],1u,true);h.frameCounter=7u;h.appendFrameHash();std::cout<<h.sramPath<<'\\n';}`);
 const ctor=path.join(dir,'constructor');
 const build=cp.spawnSync(process.env.CXX||'c++',['-std=c++20','-O0','-g0','-I'+path.join(dir,'src'),path.join(dir,'constructor.cpp'),'-o',ctor],{encoding:'utf8'});
 assert.equal(build.status,0,build.stderr||String(build.error));
 const original=path.join(dir,'normal.srm'),isolated=path.join(dir,'isolated.srm');
 const hashes=path.join(dir,'isolated-frames.txt');
 const direct=cp.spawnSync(ctor,[romfile,original],{encoding:'utf8',env:{...process.env,FORJA65_SRAM_PATH:''},cwd:dir});
 assert.equal(direct.status,0,direct.stderr);assert.equal(direct.stdout.trim(),original);
 const test=cp.spawnSync(ctor,[romfile,original],{encoding:'utf8',env:{...process.env,FORJA65_SRAM_PATH:isolated,FORJA65_FRAME_HASH_PATH:hashes,FORJA65_FRAME_HASHES:'1'},cwd:dir});
 assert.equal(test.status,0,test.stderr);assert.equal(test.stdout.trim(),isolated);
 assert.equal(fs.readFileSync(hashes,'utf8').includes('frame=7 framebuffer='),true);
 console.log('FORJA65_SRAM_ISOLATION_V0382_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
