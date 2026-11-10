'use strict';
// Verify the real generated C++ runtime (not a JavaScript mock).
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'tetris-v0401-fixture.sfc');
const emitted=F.generateProject(rom,F.analyze(rom,512));
const source=emitted['src/runtime.hpp'];
for(const expected of [
  'SpriteRow spriteRow{};const SpriteRow*sprites=nullptr;',
  'fb[row+(std::size_t)x]=rgba15(finalMain15(x,y,false,sprites,&bgTiles));',
  'nativeDmaEnabled=(dm.empty()||dm=="native"||dm=="auto");',
  'void executeDma(std::uint8_t mask)'
])if(!source.includes(expected))throw new Error('Generated runtime missing: '+expected);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'forja-tetris-v0401-'));
try{
  fs.mkdirSync(path.join(root,'assets'));
  fs.writeFileSync(path.join(root,'runtime.hpp'),source);
  fs.writeFileSync(path.join(root,'assets','cart-data.bin'),emitted['assets/cart-data.bin']);
  for(const [name,fixture] of [
    ['ppu_snapshot','tetris_ppu_snapshot_row_v0401.cpp'],
    ['dma_parity','tetris_dma_native_parity_v0401.cpp']
  ]){
    const src=path.join(__dirname,'fixtures',fixture);
    fs.copyFileSync(src,path.join(root,name+'.cpp'));
    const exe=path.join(root,process.platform==='win32'?name+'.exe':name);
    cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-Wall','-Wextra','-Wpedantic','-Werror',name+'.cpp','-o',exe],{cwd:root,stdio:'inherit'});
    cp.execFileSync(exe,[],{cwd:root,stdio:'inherit'});
  }
  console.log('FORJA65_TETRIS_PPU_DMA_GENERATOR_PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}
