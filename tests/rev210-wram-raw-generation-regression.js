'use strict';
// Check that the generated runtime exports unmodified 128 KiB end-frame snapshots.
const F=require('../forja65-core');
const cp=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const rom=F.loadRom(F.makeSyntheticRom());
const files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev210-wram-'));
const src=String.raw`#include "runtime.hpp"
#include <filesystem>
#include <fstream>
#include <iterator>
#include <iostream>
int main(){
  SnesRuntime hw;
  hw.ram[0x100]=0x44;
  hw.frameCounter=10;
  hw.appendWramRawSnapshot();
  hw.ram[0x100]=0x66;
  hw.frameCounter=11;
  hw.appendWramRawSnapshot();
  std::cout<<"WRAM_SNAPSHOT_REV210_PASS\n";
  return 0;
}`;
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
  fs.writeFileSync(path.join(dir,'probe.cpp'),src);
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-Wall','-Wextra','-Werror','probe.cpp','-o','probe'],{cwd:dir,stdio:'inherit',timeout:120000});
  const output=cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,
    env:{...process.env,FORJA65_WRAM_RAW_DIR:path.join(dir,'snapshots'),FORJA65_WRAM_RAW_MAX:'2'},encoding:'utf8',timeout:15000});
  assert(output.includes('WRAM_SNAPSHOT_REV210_PASS'));
  const folder=path.join(dir,'snapshots');
  const rows=fs.readFileSync(path.join(folder,'frames.csv'),'utf8').trim().split(/\r?\n/);
  assert.deepEqual(rows,['frame,path','10,0000000010.wram','11,0000000011.wram']);
  for(const [frame,value] of [[10,0x44],[11,0x66]]){
    const bytes=fs.readFileSync(path.join(folder,String(frame).padStart(10,'0')+'.wram'));
    assert.equal(bytes.length,0x20000);
    assert.equal(bytes[0x100],value);
  }
  console.log('REV210_WRAM_RAW_GENERATION_PASS 2 snapshots 128KiB + manifest; -Werror');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
