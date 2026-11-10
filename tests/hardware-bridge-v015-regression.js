const C=require('../forja65-core.js');
function romWith(code){const d=C.makeSyntheticRom();d.set(code,0);return C.loadRom(d,'hardware-v015.sfc');}
// LDA #$8F; STA $2100; STZ $4200; LDA #$01; STA $420B; STZ $420C; RTS
const a=C.analyze(romWith([0xA9,0x8F,0x8D,0x00,0x21,0x9C,0x00,0x42,0xA9,0x01,0x8D,0x0B,0x42,0x9C,0x0C,0x42,0x60]),128);
if(!a.issues.some(x=>x.kind==='HW-NATIVE'&&/2100/.test(x.detail))) throw new Error('INIDISP not native');
if(!a.issues.some(x=>x.kind==='HW-NATIVE'&&/4200/.test(x.detail))) throw new Error('NMITIMEN not native');
if(!a.issues.some(x=>x.kind==='HW-NATIVE'&&/420B/.test(x.detail))) throw new Error('MDMAEN not native');
if(!a.issues.some(x=>x.kind==='HW-NATIVE'&&/420C/.test(x.detail))) throw new Error('HDMA 420C should be native in current runtime');
if(a.hardwareNative<4||a.hardwarePending<0) throw new Error('hardware counters');
const files=C.generateProject(romWith([0x60]),C.analyze(romWith([0x60]),16));
if(!files['src/runtime.hpp'].includes('executeDma')) throw new Error('DMA executor missing');
if(!files['src/runtime.hpp'].includes('PpuState')) throw new Error('PPU state missing');
if(!files['src/runtime.hpp'].includes('ApuBridge')) throw new Error('APU bridge missing');
console.log('Hardware bridge v0.1.5 regression: PASS', {native:a.hardwareNative,pending:a.hardwarePending});
