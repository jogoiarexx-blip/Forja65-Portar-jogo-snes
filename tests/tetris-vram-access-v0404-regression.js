'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'tetris-v0404-test.sfc');
const emitted=F.generateProject(rom,F.analyze(rom,512));
const src=emitted['src/runtime.hpp'];
for(const s of ['void writeVramDataIgnored(', 'bool vramAccessibleNow()', 'vramBlockedWrites++', '# vram_blocked_writes', 'updateVramReadBuffer();vmadd=(std::uint16_t)(vmadd+vramStep());'])
 if(!src.includes(s))throw new Error('missing VRAM access feature: '+s);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-tetris-404-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),src);
 fs.copyFileSync(path.join(__dirname,'fixtures','tetris_vram_access_v0404.cpp'),path.join(dir,'test.cpp'));
 const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','test.cpp','-o',exe],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(exe,[],{cwd:dir,stdio:'inherit'});
 console.log('FORJA65_TETRIS_VRAM_ACCESS_V0404_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
