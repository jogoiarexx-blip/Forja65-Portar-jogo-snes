// Reference: ares 9408cb43d4948fc3ea6e152a307a34348df3fe04, ares/sfc/cpu/{dma,irq,io,timing}.cpp.
// Pinned ares hdmaSetup loads the first descriptor; hdmaRun transfers then reloads.
// HDMA retains this runtime's approximate 18-clock global synchronization; this is not an arbitration oracle.
// DMA counts the fixed start cost + per-channel sync + two-byte transfer (8+8+16).
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
const rom=F.loadRom(F.makeSyntheticRom(),'v032-stall.sfc'),a=F.analyze(rom,1024),p=F.generateProject(rom,a),h=p['src/runtime.hpp'],g=Object.entries(p).filter(([k])=>k==='src/dispatch.cpp'||/^src\/generated_\d+\.cpp$/.test(k)).map(([,v])=>String(v)).join('\n');
for(const q of ['WRAM_REFRESH_MC=538u','WRAM_REFRESH_CYCLES=40u','DMA_SYNC_MC=18u','dmaStallMasterCycles','hdmaStallMasterCycles','wramRefreshStallMasterCycles','interruptEntryMasterCycles'])ok(h.includes(q),'runtime sem '+q);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v032-stall-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});fs.writeFileSync(path.join(dir,'src','runtime.hpp'),h);
fs.writeFileSync(path.join(dir,'test.cpp'),`#include "src/runtime.hpp"\n#include <cassert>\nint main(){\n SnesRuntime hw;hw.beginFrame();hw.beginScanline(0);hw.lastInstructionMasterCycles=0;hw.advanceCpuMasterCycles(534u);assert(hw.wramRefreshAppliedThisLine);assert(hw.wramRefreshStallMasterCycles==40u);assert(hw.lastInstructionMasterCycles==574u);\n SnesRuntime d;d.frameTimingActive=false;d.dma[0].a1b=0x7E;d.dma[0].a1t=0;d.dma[0].das=2;d.dma[0].bbad=0x00;d.ram[0]=1;d.ram[1]=2;d.executeDma(1);assert(d.dmaStallMasterCycles==32u);\n SnesRuntime hd;hd.frameTimingActive=false;hd.ram[0]=0x81;hd.ram[1]=0x0F;hd.dma[0].a1b=0x7E;hd.dma[0].a1t=0;hd.dma[0].bbad=0;hd.io.hdmaen=1;hd.beginFrame();hd.advanceCpuMasterCycles(11);assert(!hd.hdmaSetupComplete&&hd.hdmaStallMasterCycles==0u);hd.advanceCpuMasterCycles(1);assert(hd.hdmaSetupComplete&&hd.hdmaStallMasterCycles==26u);assert(hd.dma[0].a2a==1&&hd.dma[0].ntrl==0x81&&hd.hwUsage.hdmaBytes==0);hd.executeHdmaLine();assert(hd.hdmaStallMasterCycles==60u);assert(hd.hwUsage.hdmaBytes==1&&hd.ppu.inidisp==0x0F);assert(hd.hdmaEnded==1&&hd.dma[0].a2a==3);\n return 0;\n}\n`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'test.cpp'),'-o',path.join(dir,'test')],{stdio:'inherit'});// REV138: o setup de HDMA passou a transferir tambem no HBlank de V=0; este teste mede o modelo antigo (so setup).
// REV143: a DMA geral ganhou os alinhamentos de entrada/saida do bsnes; este teste mede o custo fixo antigo (8+8+16).
cp.execFileSync(path.join(dir,'test'),[],{stdio:'inherit',env:{...process.env,FORJA65_HDMA_V0_TRANSFER:'0',FORJA65_DMA_SYNC:'legacy'}});
console.log('BUS_STALLS_V032_PASS',{wram:40,dma2:32,hdmaSetup:26,hdma1:34,hdmaTotal:60});
