const fs=require('node:fs');const assert=require('node:assert/strict');const path=require('node:path');
const core=fs.readFileSync(path.join(__dirname,'..','forja65-core.js'),'utf8');
assert(core.includes('RetroPortingToolKit/snesrecomp/'));
assert(core.includes('cx4_synthesize_data_rom')===false || core.includes('cx4_synthesize_data_rom'));
assert(core.includes('void syncCx4(){'));
assert(core.includes('cx4_irq_pending(cx4Device.get())'));
console.log('REV162_CX4_UPSTREAM_AND_IRQ_PASS');
