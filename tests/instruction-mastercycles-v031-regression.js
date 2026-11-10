// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
ok(/^0\.(?:3|4)\.\d+/.test(F.VERSION),'familia v0.3.x esperada: '+F.VERSION);
const rom=F.loadRom(F.makeSyntheticRom(),'v031.sfc'),a=F.analyze(rom,1024),p=F.generateProject(rom,a),h=p['src/runtime.hpp'],g=Object.entries(p).filter(([k])=>k==='src/dispatch.cpp'||/^src\/generated_\d+\.cpp$/.test(k)).map(([,v])=>String(v)).join('\n');
for(const q of ['advanceCpuInstruction','busMasterCycles','cpuMasterClock','cpuInstructionCount','lastInstructionMasterCycles','timingOverflowMasterCycles','syncPpuBeforeMutation'])ok(h.includes(q),'runtime sem '+q);
ok(g.includes('hw.advanceCpuInstruction('),'codigo recompilado sem timing por instrucao');
ok(g.indexOf('hw.advanceCpuInstruction(')<g.indexOf('cpu.setFlag'),'timing nao vem antes da semantica da instrucao');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v031-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});fs.writeFileSync(path.join(dir,'src','runtime.hpp'),h);
fs.writeFileSync(path.join(dir,'test.cpp'),`#include "src/runtime.hpp"\n#include <cassert>\nint main(){\n SnesRuntime hw;\n assert(hw.busMasterCycles(0x002100u)==6u);\n assert(hw.busMasterCycles(0x004016u)==12u);\n assert(hw.busMasterCycles(0x000100u)==8u);\n assert(hw.busMasterCycles(0x7E0000u)==8u);\n assert(hw.busMasterCycles(0x008000u)==8u);\n assert(hw.busMasterCycles(0x808000u)==8u);\n hw.io.memsel=1;assert(hw.busMasterCycles(0x808000u)==6u);assert(hw.busMasterCycles(0xC00000u)==6u);\n hw.io.memsel=0;\n hw.advanceCpuInstruction(0x008000u,2u,1u,SnesRuntime::NO_TIMING_ADDR,0u,SnesRuntime::NO_TIMING_ADDR,0u,0u);assert(hw.lastInstructionMasterCycles==14u);\n hw.advanceCpuInstruction(0x008000u,4u,3u,0x002100u,1u,SnesRuntime::NO_TIMING_ADDR,0u,0u);assert(hw.lastInstructionMasterCycles==30u);\n hw.advanceCpuInstruction(0x008000u,4u,3u,0x7E1000u,1u,SnesRuntime::NO_TIMING_ADDR,0u,0u);assert(hw.lastInstructionMasterCycles==32u);\n hw.advanceCpuInstruction(0x008000u,6u,3u,SnesRuntime::NO_TIMING_ADDR,0u,SnesRuntime::NO_TIMING_ADDR,0u,2u);assert(hw.lastInstructionMasterCycles==46u);\n hw.lastInstructionMasterCycles=0;hw.addCpuInternalCycles(2u);assert(hw.lastInstructionMasterCycles==12u);\n hw.lastInstructionMasterCycles=0;hw.advanceCpuBlockMove(0x008000u,2u,0x7Eu,0x7Fu);assert(hw.lastInstructionMasterCycles==104u); /* 3 code fetches + read/write + 2 idle per byte: 52 MC. Confirmed by the ares block-move/wait micro-reference. */\n hw.cpuMasterClock=0;hw.cpuInstructionCount=0;hw.beginFrame();hw.beginScanline(0);assert(hw.currentMasterCycle==4u);\n hw.advanceCpuInstruction(0x008000u,4u,3u,0x002100u,1u,SnesRuntime::NO_TIMING_ADDR,0u,0u);assert(hw.currentMasterCycle==34u);assert(hw.rasterCursorX==0u);\n hw.write8(0x002100u,0x0Fu);assert(hw.rasterCursorX==5u);assert(hw.ppu.inidisp==0x0Fu);\n assert(hw.cpuInstructionCount==1u);assert(hw.cpuMasterClock==30u);\n return 0;\n}\n`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{stdio:'inherit'});cp.execFileSync(path.join(dir,'test'),[],{stdio:'inherit'});

// Branch timing: +1 CPU cycle when taken, with one extra only on emulation page-cross.
function branchProject(reset,rel){
  const d=F.makeSyntheticRom();d[0x7FFC]=reset&255;d[0x7FFD]=(reset>>8)&255;
  const off=reset&0x7FFF;d[off]=0xD0;d[off+1]=rel&255;d[(off+2)&0x7FFF]=0xEA;d[(off+3)&0x7FFF]=0x60;
  const target=(reset+2+((rel&0x80)?rel-256:rel))&0xFFFF, to=target&0x7FFF;d[to]=0x60;
  const rr=F.loadRom(d,'branch.sfc'),aa=F.analyze(rr,256);{const pp=F.generateProject(rr,aa);return Object.entries(pp).filter(([k])=>k==='src/dispatch.cpp'||/^src\/generated_\d+\.cpp$/.test(k)).map(([,v])=>String(v)).join('\n');}
}
const bSame=branchProject(0x8000,0x02),bCross=branchProject(0x80FD,0x02);
ok(bSame.includes('if (!cpu.z) { hw.addCpuInternalCycles(1u);'),'branch tomado sem page-cross deve custar +1 ciclo');
ok(bCross.includes('if (!cpu.z) { hw.addCpuInternalCycles(2u);'),'branch tomado com page-cross em emulacao deve custar +2 ciclos');
console.log('Instruction master-cycles v0.3.1 regression: PASS',{slowNop:14,staPpu:30,ldaWram:32,jsrSlowStack:46,blockMove2:104,rasterSplit:5,branchSamePage:1,branchPageCross:2});
