"use strict";
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'rev201-sram.sfc');
const output=F.generateProject(rom,F.analyze(rom,384));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-rev201-'));
try{
  fs.mkdirSync(path.join(dir,'assets'));
  fs.writeFileSync(path.join(dir,'runtime.hpp'),output['src/runtime.hpp']);
  fs.writeFileSync(path.join(dir,'assets/cart-data.bin'),output['assets/cart-data.bin']);
  const source=output['src/runtime.hpp'];
  for(const term of ['forja65XInputMask','forja65WinmmMask','Forja65Sdl2Pads','SDL_GameControllerAddMappingsFromFile','setJoy2(pads[1])','if(replayActive)return;','REV201: commit battery-backed RAM','checkSramHotkey','initPersistentSramPath']){
    if(!source.includes(term))throw new Error('Missing generated feature: '+term);
  }
  const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
  fs.copyFileSync(path.join(__dirname,'fixtures/rev201_persistent_sram.cpp'),path.join(dir,'test.cpp'));
  const args=['-std=c++20','-O0','test.cpp','-o',exe,...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])];
  cp.execFileSync(process.env.CXX||'g++',args,{cwd:dir,stdio:'inherit'});
  const result=cp.spawnSync(exe,[],{cwd:dir,encoding:'utf-8'});
  process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
  if(result.status!==0||result.error)throw new Error('Persistent SRAM regression failed '+(result.error||result.status));
  console.log('REV201_SRAM_GAMEPAD_REGRESSION_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
