// REV160: descriptor fixture predates the V=0 payload; preserve that explicit contract.
'use strict';
// Cross-feed integration: exercise emitted runtime.hpp, not a mock of the generator.
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'hdma-0400.sfc');
const emitted=F.generateProject(rom,F.analyze(rom,512));
const source=emitted['src/runtime.hpp'];
for(const expect of ['hdmaEveryLine[ch]=desc>0x80u','(void)newly;hdmaActive=requested;','void startHdmaFrame(std::uint8_t mask)']) {
  if(!source.includes(expect))throw new Error('Generated runtime missing HDMA rule: '+expect);
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-hdma-0400-'));
try{
  fs.mkdirSync(path.join(tmp,'assets'));
  fs.writeFileSync(path.join(tmp,'runtime.hpp'),source);
  fs.writeFileSync(path.join(tmp,'assets/cart-data.bin'),emitted['assets/cart-data.bin']);
  fs.copyFileSync(path.join(__dirname,'fixtures','tetris_hdma_v0400.cpp'),path.join(tmp,'test.cpp'));
  const out=path.join(tmp,process.platform==='win32'?'hdma.exe':'hdma');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra','-Wpedantic','-Werror','test.cpp','-o',out],{cwd:tmp,stdio:'inherit'});
  cp.execFileSync(out,[],{cwd:tmp,stdio:'inherit',env:{...process.env,FORJA65_HDMA_V0_TRANSFER:'0'}});
  console.log('FORJA65_HDMA_DESCRIPTOR_GENERATOR_PASS');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
