'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'tetris-v0402-raster.sfc');
const emitted=F.generateProject(rom,F.analyze(rom,512));
const source=emitted['src/runtime.hpp'];
for(const expected of [
  'static bool ppuWriteChangesVisiblePixels(std::uint16_t port)',
  'syncPpuForWrite(lo);',
  'void writePpuRegisterProfile(const std::string&path=',
  'ppuRegisterReadCounts[lo-0x2100u]'
])if(!source.includes(expected))throw new Error('generated runtime missing: '+expected);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-tetris-v0402-'));
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),source);
  fs.copyFileSync(path.join(__dirname,'fixtures','tetris_ppu_raster_sync_v0402.cpp'),path.join(dir,'test.cpp'));
  const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra','-Wpedantic','-Werror','test.cpp','-o',exe],{cwd:dir,stdio:'inherit'});
  cp.execFileSync(exe,[],{cwd:dir,stdio:'inherit'});
  console.log('FORJA65_TETRIS_PPU_RASTER_V0402_GENERATOR_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
