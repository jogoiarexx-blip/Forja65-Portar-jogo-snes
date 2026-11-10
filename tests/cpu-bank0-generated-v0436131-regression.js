'use strict';
const F=require('../forja65-core'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),os=require('node:os'),path=require('node:path');
const romBytes=F.makeSyntheticRom();
romBytes.set([0xC2,0x20,0xA5,0x00,0x95,0x00,0xE6,0x00,0xA3,0x00,0x83,0x00,0xAF,0xFF,0xFF,0x00,0xDB],0);
const rom=F.loadRom(romBytes,'rev131-generated.sfc');const plan=F.analyze(rom,96),files=F.generateProject(rom,plan);
const text=Object.entries(files).filter(([k])=>/^src\/generated_.*\.cpp$/.test(k)).map(([,s])=>s).join('\n');
const expected=[
 /readW\(cpu\.address\("dp", 0x0u\), cpu\.m8\?8:16, true\)/,
 /hw\.write\(cpu\.address\("dpx", 0x0u\), cpu\.a, cpu\.m8\?8:16, true\)/,
 /cpu\.incMem\(hw, cpu\.address\("dp", 0x0u\), cpu\.m8\?8:16, true\)/,
 /readW\(cpu\.addressStack\(0x0u\), cpu\.m8\?8:16, true\)/,
 /hw\.write\(cpu\.addressStack\(0x0u\), cpu\.a, cpu\.m8\?8:16, true\)/,
 /readW\(0xFFFFu, cpu\.m8\?8:16\)/,
 ];
for(const r of expected)assert.match(text,r);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev131-generated-'));
try{
  fs.writeFileSync(path.join(tmp,'runtime.hpp'),files['src/runtime.hpp']);fs.writeFileSync(path.join(tmp,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
  fs.writeFileSync(path.join(tmp,'probe.cpp'),'#include "runtime.hpp"\nint main(){SnesRuntime h;CpuState c;h.ram[0]=1;return h.readW(0xffff,16,true)<256?0:0;}\n');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-I'+tmp,'-fsyntax-only',path.join(tmp,'probe.cpp')],{cwd:tmp,timeout:180000});
  console.log('CPU_BANK0_GENERATED_REV131_PASS codegen_checks='+expected.length+' runtime_header_compiled=1');
}finally{fs.rmSync(tmp,{force:true,recursive:true});}
