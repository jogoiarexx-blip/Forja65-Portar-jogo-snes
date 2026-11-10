const fs=require('fs');const assert=require('node:assert/strict');
const t=fs.readFileSync(require('path').join(__dirname,'../forja65-core.js'),'utf8');
for(const token of [
  'void syncCx4(){',
  'cx4_sync(cx4Device.get(),cpuMasterClock);',
  'cpuIrqInterruptPending=io.irqPending||cx4IrqLevel;',
  'cpuIrqInterruptPending=cx4IrqLevel;',
  'syncCx4(); // External IRQ must progress even without Cx4 register reads.',
  'cx4StatusReads','cx4ProgramStarts'
])assert(t.includes(token),`missing ${token}`);
console.log('REV161_CX4_IRQ_TEMPLATE_PASS');
