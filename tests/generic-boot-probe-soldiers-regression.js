'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'synthetic-boot-probe.sfc');
const generated=C.generateProject(rom,C.analyze(rom,500));
const src=generated['src/runtime.hpp'];
const main=generated['src/main.cpp'];
assert.match(src,/void writeBootProbe\(/);
assert.match(src,/apu_handshake_stall_suspected/);
assert.match(src,/spc_to_cpu_/);
assert.match(src,/cpu_to_spc_/);
assert.match(main,/hw\.writeBootProbe\(\)/);
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-boot-probe-'));
try{
  fs.writeFileSync(path.join(folder,'runtime.hpp'),src);
  const check=`#include "runtime.hpp"\n#include <iostream>\n#include <fstream>\n#include <string>\nint main(){SnesRuntime hw; hw.frameCounter=35;hw.hwUsage.apuReads=2500;hw.hwUsage.apuWrites=1; hw.ppu.regs[0]=0x80;hw.lastInstructionPc=0xC20391;hw.apu.spc.pc=0x0011;hw.apu.spc.portOut[0]=2;hw.apu.spc.portIn[0]=0xc3;hw.writeBootProbe("probe.txt");std::ifstream f("probe.txt");std::string t((std::istreambuf_iterator<char>(f)),{});if(t.find("apu_handshake_stall_suspected=YES")==std::string::npos||t.find("last_cpu_pc=0xc20391")==std::string::npos||t.find("spc_to_cpu_0=0x02")==std::string::npos)return 3;hw.io.nmiEnable=true;hw.writeBootProbe("probe2.txt");std::ifstream g("probe2.txt");std::string u((std::istreambuf_iterator<char>(g)),{});if(u.find("apu_handshake_stall_suspected=NO")==std::string::npos)return 4;std::cout<<"FORJA65_BOOT_PROBE_PASS\\n";}\n`;
  fs.writeFileSync(path.join(folder,'test.cpp'),check);
  const r=cp.spawnSync('g++',['-std=c++20','-O0','-g0','-I',folder,'test.cpp','-o','test'],{cwd:folder,encoding:'utf8',timeout:50000});
  if(r.error)throw r.error;
  assert.equal(r.status,0,`C++ compile failed: ${r.stderr}`);
  const v=cp.spawnSync(path.join(folder,'test'),[],{cwd:folder,encoding:'utf8',timeout:10000});
  if(v.error)throw v.error;
  assert.equal(v.status,0,`Boot probe smoke failed: ${v.stderr}`);
  process.stdout.write(v.stdout);
}finally{fs.rmSync(folder,{force:true,recursive:true});}
