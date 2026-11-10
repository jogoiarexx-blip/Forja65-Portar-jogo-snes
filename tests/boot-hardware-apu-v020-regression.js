const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
let d=F.makeSyntheticRom();
// Touch APU, math, WRAM port and joy serial using opcodes already native.
// LDA #$CC; STA $2140; LDA #$03; STA $4202; LDA #$07; STA $4203; RTS
d.set([0xA9,0xCC,0x8D,0x40,0x21,0xA9,0x03,0x8D,0x02,0x42,0xA9,0x07,0x8D,0x03,0x42,0x60],0);
const rom=F.loadRom(d,'v020.sfc');
const a=F.analyze(rom,512);
ok(a.unsupported===0,'unexpected unsupported opcode');
ok(a.issues.some(x=>x.kind==='HW-NATIVE'&&/SPC700 de 256 opcodes/.test(x.detail)),'APU SPC700 runtime diagnostic missing');
ok(a.issues.some(x=>x.kind==='HW-NATIVE'&&/4202/.test(x.detail)),'math hardware diagnostic missing');
const p=F.generateProject(rom,a);
const h=p['src/runtime.hpp'];
ok(h.includes('struct ApuBridge'),'ApuBridge missing');
ok(h.includes('kForja65Ipl')&&h.includes('forja65SpcStep'),'SPC700 IPL/interpreter missing');
ok(h.includes('void multiply'),'math multiply missing');
ok(h.includes('void divide'),'math divide missing');
ok(h.includes('wramPortAddr'),'WRAM port missing');
ok(h.includes('readJoySerial'),'serial joypad missing');
ok(p['src/main.cpp'].includes('while(!hw.stopped)')&&p['src/main.cpp'].includes('forja65_wait(cpu,hw,hw.lastInstructionPc)'),'native scheduler fallback missing');
console.log('Boot hardware/APU v0.2.0 regression: PASS',{decoded:a.decoded,native:a.native});
